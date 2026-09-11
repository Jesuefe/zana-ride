package rw.zanaride.driver

import android.view.ViewGroup
import android.widget.FrameLayout
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.mapbox.api.directions.v5.DirectionsCriteria
import com.mapbox.api.directions.v5.models.RouteOptions
import com.mapbox.geojson.LineString
import com.mapbox.geojson.Point
import com.mapbox.maps.CameraOptions
import com.mapbox.maps.MapView
import com.mapbox.maps.Style
import com.mapbox.maps.extension.style.layers.generated.lineLayer
import com.mapbox.maps.extension.style.sources.generated.GeoJsonSource
import com.mapbox.maps.extension.style.sources.generated.geoJsonSource
import com.mapbox.maps.plugin.locationcomponent.location
import com.mapbox.navigation.base.options.NavigationOptions
import com.mapbox.navigation.base.route.NavigationRoute
import com.mapbox.navigation.base.route.NavigationRouterCallback
import com.mapbox.navigation.base.route.RouterFailure
import com.mapbox.navigation.base.trip.model.RouteLegProgress
import com.mapbox.navigation.base.trip.model.RouteProgress
import com.mapbox.navigation.core.MapboxNavigation
import com.mapbox.navigation.core.arrival.ArrivalObserver
import com.mapbox.navigation.core.directions.session.RoutesObserver
import com.mapbox.navigation.core.trip.session.LocationMatcherResult
import com.mapbox.navigation.core.trip.session.LocationObserver

/**
 * A small, direct wrapper around Mapbox's real Navigation Core SDK and Maps
 * SDK — not the third-party npm plugins, which are either years stale or
 * don't support Android at all (checked before building this).
 *
 * Deliberately does NOT use Mapbox's own "drop-in" NavigationView — that
 * component is documented and exemplified almost entirely in Kotlin/XML
 * with a real-but-different API shape that couldn't be confirmed
 * confidently enough to write blind. Instead this draws the route as a
 * plain line layer and uses the Maps SDK's Location Component for the
 * position puck — both long-standing, stable parts of the Maps SDK, not
 * the newer, less-certain drop-in UI. Real routing, real rerouting, real
 * position — plainer turn-by-turn chrome than Mapbox's own polished UI
 * would give, traded deliberately for using only APIs this plugin can be
 * reasonably confident are correct, since none of this has been compiled
 * anywhere — that happens for the first time in CI, not here.
 *
 * Surface matches what the web hook expects: initialize, showNavigationView,
 * startNavigation, stopNavigation, plus onNavigationReady/onArrival/
 * onRouteChanged/onNavigationClosed events.
 */
@CapacitorPlugin(name = "MapboxNavigation")
class MapboxNavigationPlugin : Plugin() {

    private var mapboxNavigation: MapboxNavigation? = null
    private var mapView: MapView? = null
    private var container: FrameLayout? = null
    private val routeSourceId = "zana-route-source"
    private val routeLayerId = "zana-route-layer"

    // Updated on every real location fix from the Navigation SDK's own
    // pipeline, registered once in initialize() rather than re-registered
    // each time the map opens — this is what startNavigation() reads as
    // the route's origin point.
    @Volatile
    private var lastLocation: Point? = null

    @PluginMethod
    fun initialize(call: PluginCall) {
        if (mapboxNavigation != null) {
            call.resolve(success())
            return
        }

        val tokenResId = activity.resources.getIdentifier(
            "mapbox_access_token", "string", activity.packageName
        )
        val token = activity.getString(tokenResId)

        val options = NavigationOptions.Builder(activity)
            .accessToken(token)
            .build()

        val nav = MapboxNavigation(options)
        mapboxNavigation = nav

        nav.registerLocationObserver(object : LocationObserver {
            override fun onNewRawLocation(rawLocation: android.location.Location) {}
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

        // Location updates only flow once a trip session is running — this
        // starts it immediately so lastLocation is populated by the time a
        // driver actually taps to navigate, not only after showNavigationView.
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
                    // The built-in position puck — a stable, long-standing
                    // part of the Maps SDK, not hand-built here.
                    mv.location.updateSettings {
                        enabled = true
                        pulsingEnabled = true
                    }
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
            // No GPS fix yet — real on a cold start or a weak signal. The
            // caller (the web hook) surfaces this as a failed start() and
            // the driver can just try again once the puck has appeared.
            call.reject("NO_CURRENT_LOCATION")
            return
        }

        // applyDefaultParams() rather than the newer applyDefaultNavigationOptions()
        // helper — this method has appeared consistently across multiple
        // Mapbox navigation SDK generations in real, confirmed examples,
        // unlike the newer one, which this plugin could not confirm the
        // real import path for confidently enough to depend on.
        val routeOptions = RouteOptions.builder()
            .applyDefaultParams()
            .accessToken(activity.getString(
                activity.resources.getIdentifier("mapbox_access_token", "string", activity.packageName)
            ))
            .coordinatesList(listOf(origin, Point.fromLngLat(lng, lat)))
            .profile(DirectionsCriteria.PROFILE_DRIVING_TRAFFIC)
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

    private fun success(): JSObject {
        val obj = JSObject()
        obj.put("success", true)
        return obj
    }
}
