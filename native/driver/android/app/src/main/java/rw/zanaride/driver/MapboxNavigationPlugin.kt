package rw.zanaride.driver

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.mapbox.api.directions.v5.DirectionsCriteria
import com.mapbox.api.directions.v5.models.BannerInstructions
import com.mapbox.api.directions.v5.models.RouteOptions
import com.mapbox.common.location.Location
import com.mapbox.geojson.LineString
import com.mapbox.geojson.Point
import com.mapbox.maps.CameraOptions
import com.mapbox.maps.MapView
import com.mapbox.maps.Style
import com.mapbox.maps.extension.style.layers.addLayer
import com.mapbox.maps.extension.style.layers.generated.lineLayer
import com.mapbox.maps.extension.style.sources.generated.GeoJsonSource
import com.mapbox.maps.extension.style.sources.addSource
import com.mapbox.maps.extension.style.sources.generated.geoJsonSource
import com.mapbox.maps.extension.style.sources.getSourceAs
import com.mapbox.maps.plugin.locationcomponent.location
import com.mapbox.navigation.base.extensions.applyDefaultNavigationOptions
import com.mapbox.navigation.base.options.NavigationOptions
import com.mapbox.navigation.base.route.NavigationRoute
import com.mapbox.navigation.base.route.NavigationRouterCallback
import com.mapbox.navigation.base.route.RouterFailure
import com.mapbox.navigation.base.trip.model.RouteLegProgress
import com.mapbox.navigation.base.trip.model.RouteProgress
import com.mapbox.navigation.core.MapboxNavigation
import com.mapbox.navigation.core.MapboxNavigationProvider
import com.mapbox.navigation.core.arrival.ArrivalObserver
import com.mapbox.navigation.core.directions.session.RoutesObserver
import com.mapbox.navigation.core.trip.session.BannerInstructionsObserver
import com.mapbox.navigation.core.trip.session.LocationMatcherResult
import com.mapbox.navigation.core.trip.session.LocationObserver

/**
 * A small, direct wrapper around Mapbox's real Navigation Core SDK and Maps
 * SDK — not the third-party npm plugins, which are either years stale or
 * don't support Android at all.
 *
 * Deliberately does NOT use Mapbox's own "drop-in" NavigationView — instead
 * draws the route as a plain line layer, uses the Maps SDK's Location
 * Component for the position puck, and now a plain native text banner for
 * turn-by-turn instructions — all long-standing, well-documented, directly
 * verified parts of the SDK, not the newer drop-in UI whose exact API this
 * plugin could not confirm confidently enough to write blind.
 *
 * The instruction banner is built as a native Android view added to the
 * same container as the map, not sent back to the web layer — the native
 * map is a full-screen overlay sitting on top of the entire React app, so
 * anything rendered in React while it's showing would be invisible,
 * hidden underneath it.
 */
@CapacitorPlugin(name = "MapboxNavigation")
class MapboxNavigationPlugin : Plugin() {

    private var mapboxNavigation: MapboxNavigation? = null
    private var mapView: MapView? = null
    private var container: FrameLayout? = null
    private var instructionBanner: LinearLayout? = null
    private var instructionText: TextView? = null
    private var instructionDistance: TextView? = null
    private val routeSourceId = "zana-route-source"
    private val routeLayerId = "zana-route-layer"

    @Volatile
    private var lastLocation: Point? = null

    @PluginMethod
    fun initialize(call: PluginCall) {
        if (mapboxNavigation != null) {
            call.resolve(success())
            return
        }

        val options = NavigationOptions.Builder(activity).build()
        val nav = MapboxNavigationProvider.create(options)
        mapboxNavigation = nav

        nav.registerLocationObserver(object : LocationObserver {
            override fun onNewRawLocation(rawLocation: Location) {}
            override fun onNewLocationMatcherResult(result: LocationMatcherResult) {
                val point = Point.fromLngLat(
                    result.enhancedLocation.longitude,
                    result.enhancedLocation.latitude
                )
                lastLocation = point
                mapView?.mapboxMap?.setCamera(
                    CameraOptions.Builder().center(point).zoom(17.0).build()
                )
            }
        })

        nav.registerArrivalObserver(object : ArrivalObserver {
            override fun onWaypointArrival(routeProgress: RouteProgress) {}
            override fun onNextRouteLegStart(routeLegProgress: RouteLegProgress) {}
            override fun onFinalDestinationArrival(routeProgress: RouteProgress) {
                notifyListeners("onArrival", JSObject())
            }
        })

        nav.registerRoutesObserver(RoutesObserver {
            notifyListeners("onRouteChanged", JSObject())
        })

        // Fires continuously during active guidance whenever the next turn
        // instruction changes — this is what actually drives the banner
        // text and distance, updated directly here rather than round-
        // tripping through JS for something purely visual like this.
        nav.registerBannerInstructionsObserver(BannerInstructionsObserver { banner: BannerInstructions ->
            updateInstructionBanner(banner)
        })

        nav.startTripSession()

        notifyListeners("onNavigationReady", JSObject())
        call.resolve(success())
    }

    @PluginMethod
    fun showNavigationView(call: PluginCall) {
        val show = call.getBoolean("show", false) ?: false

        activity.runOnUiThread {
            if (show) {
                if (container == null) {
                    val frame = FrameLayout(activity)
                    val params = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    activity.addContentView(frame, params)
                    container = frame
                }
                if (mapView == null) {
                    val mv = MapView(activity)
                    container?.addView(mv)
                    mapView = mv
                    mv.mapboxMap.loadStyle(Style.MAPBOX_STREETS)
                    mv.location.updateSettings {
                        enabled = true
                        pulsingEnabled = true
                    }
                }
                if (instructionBanner == null) {
                    buildInstructionBanner()
                }
                container?.visibility = FrameLayout.VISIBLE
            } else {
                container?.visibility = FrameLayout.GONE
            }
            call.resolve(success())
        }
    }

    @PluginMethod
    fun startNavigation(call: PluginCall) {
        val nav = mapboxNavigation
        if (nav == null) {
            call.reject("NOT_INITIALIZED")
            return
        }

        val lat = call.getDouble("destinationLatitude")
        val lng = call.getDouble("destinationLongitude")
        if (lat == null || lng == null) {
            call.reject("MISSING_DESTINATION")
            return
        }

        val origin = lastLocation
        if (origin == null) {
            call.reject("NO_CURRENT_LOCATION")
            return
        }

        val routeOptions = RouteOptions.builder()
            .applyDefaultNavigationOptions()
            .coordinatesList(listOf(origin, Point.fromLngLat(lng, lat)))
            .profile(DirectionsCriteria.PROFILE_DRIVING_TRAFFIC)
            // Without this, the route response never includes turn-by-turn
            // banner data at all, and BannerInstructionsObserver simply
            // never fires — silently, with no error to point at why.
            .bannerInstructions(true)
            .build()

        nav.requestRoutes(
            routeOptions,
            object : NavigationRouterCallback {
                override fun onRoutesReady(routes: List<NavigationRoute>, routerOrigin: String) {
                    nav.setNavigationRoutes(routes)
                    drawRouteLine(routes.firstOrNull())
                    call.resolve(success())
                }

                override fun onFailure(reasons: List<RouterFailure>, routeOptions: RouteOptions) {
                    call.reject("ROUTE_FAILED " + reasons.joinToString())
                }

                override fun onCanceled(routeOptions: RouteOptions, routerOrigin: String) {
                    call.reject("ROUTE_CANCELED")
                }
            }
        )
    }

    @PluginMethod
    fun stopNavigation(call: PluginCall) {
        mapboxNavigation?.setNavigationRoutes(emptyList())
        instructionBanner?.visibility = LinearLayout.GONE
        call.resolve(success())
    }

    private fun drawRouteLine(route: NavigationRoute?) {
        val geometry = route?.directionsRoute?.geometry() ?: return
        val mv = mapView ?: return
        val lineString = LineString.fromPolyline(geometry, 6)

        mv.mapboxMap.getStyle { style ->
            val existing = style.getSourceAs<GeoJsonSource>(routeSourceId)
            if (existing != null) {
                existing.geometry(lineString)
            } else {
                style.addSource(geoJsonSource(routeSourceId) { geometry(lineString) })
                style.addLayer(
                    lineLayer(routeLayerId, routeSourceId) {
                        lineColor("#00A082")
                        lineWidth(6.0)
                    }
                )
            }
        }
    }

    /**
     * A plain native banner, built once and reused — styled to roughly
     * match the dark green instruction banner already used in the web
     * map, so it reads as the same product rather than a different one.
     */
    private fun buildInstructionBanner() {
        val density = activity.resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()

        val banner = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(14))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#E6005040")) // dark green, ~90% opacity
            }
            visibility = LinearLayout.GONE
        }

        val text = TextView(activity).apply {
            setTextColor(Color.WHITE)
            textSize = 17f
            typeface = Typeface.DEFAULT_BOLD
        }
        val distance = TextView(activity).apply {
            setTextColor(Color.parseColor("#B3FFFFFF")) // white ~70% opacity
            textSize = 12f
            setPadding(0, dp(2), 0, 0)
        }

        banner.addView(text)
        banner.addView(distance)

        val params = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
        params.gravity = Gravity.TOP

        container?.addView(banner, params)
        instructionBanner = banner
        instructionText = text
        instructionDistance = distance
    }

    private fun updateInstructionBanner(banner: BannerInstructions) {
        activity.runOnUiThread {
            instructionText?.text = banner.primary().text()
            val meters = banner.distanceAlongGeometry()
            instructionDistance?.text = if (meters >= 1000) {
                "in %.1f km".format(meters / 1000)
            } else {
                "in ${meters.toInt()} m"
            }
            instructionBanner?.visibility = LinearLayout.VISIBLE
        }
    }

    private fun success(): JSObject {
        val obj = JSObject()
        obj.put("success", true)
        return obj
    }
}
