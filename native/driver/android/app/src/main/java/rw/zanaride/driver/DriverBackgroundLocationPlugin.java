package rw.zanaride.driver;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "DriverBackgroundLocation",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class DriverBackgroundLocationPlugin extends Plugin {
    @PluginMethod
    public void startTracking(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermissionResult");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void locationPermissionResult(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission is required to go online.");
            return;
        }
        startService(call);
    }

    private void startService(PluginCall call) {
        String apiUrl = call.getString("apiUrl");
        String token = call.getString("token");
        String sessionId = call.getString("sessionId");
        if (apiUrl == null || token == null || sessionId == null) {
            call.reject("Missing API URL, authentication token or driver session.");
            return;
        }
        Intent intent = new Intent(getContext(), DriverBackgroundLocationService.class);
        intent.putExtra("apiUrl", apiUrl);
        intent.putExtra("token", token);
        intent.putExtra("sessionId", sessionId);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not start background location service.", e);
        }
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Intent intent = new Intent(getContext(), DriverBackgroundLocationService.class);
        intent.setAction(DriverBackgroundLocationService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }
}
