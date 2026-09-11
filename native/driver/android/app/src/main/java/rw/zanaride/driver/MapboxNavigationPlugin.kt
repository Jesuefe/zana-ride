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
import com.mapbox.common.location.Location
import com.mapbox.geojson.LineString
import com.mapbox.geojson.Point
import com.mapbox.maps.CameraOptions
import com.mapbox.maps.MapView
import com.mapbox.maps.Style
import com.mapbox.maps.extension.style.layers.generated.lineLayer
import com.mapbox.maps.extension.style.sources.generated.GeoJsonSource
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
import com.mapbox.navigation.core.trip.session.LocationMatcherResult
import com.mapbox.navigation.core.trip.session.LocationObserver

@CapacitorPlugin(name = "MapboxNavigation")
class MapboxNavigationPlugin : Plugin() {

    private var mapboxNavigation: MapboxNavigation? = null
    private var mapView: MapView? = null
    private var container: FrameLayout? = null
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
