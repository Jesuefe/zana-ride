package rw.zanaride.driver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DriverBackgroundLocationService extends Service implements LocationListener {
    public static final String ACTION_STOP = "rw.zanaride.driver.STOP_LOCATION";
    private static final String CHANNEL_ID = "zana_driver_location";
    private static final int NOTIFICATION_ID = 7314;
    private static final String PREFS = "zana_driver_location";
    private LocationManager locationManager;
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private String apiUrl, token, sessionId;

    @Override public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopTracking();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (intent != null) {
            apiUrl = intent.getStringExtra("apiUrl");
            token = intent.getStringExtra("token");
            sessionId = intent.getStringExtra("sessionId");
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString("apiUrl", apiUrl).putString("token", token).putString("sessionId", sessionId).apply();
        } else {
            android.content.SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
            apiUrl = p.getString("apiUrl", null);
            token = p.getString("token", null);
            sessionId = p.getString("sessionId", null);
        }
        if (apiUrl == null || token == null || sessionId == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("Zana Driver is online")
            .setContentText("Location sharing is active while you are online.")
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        try {
            if (checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                stopSelf();
                return START_NOT_STICKY;
            }
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 10000L, 10f, this);
            Location last = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (last != null) onLocationChanged(last);
        } catch (SecurityException ignored) {
            stopSelf();
            return START_NOT_STICKY;
        } catch (Exception ignored) { }
        return START_STICKY;
    }

    @Override public void onLocationChanged(Location location) {
        final double lat = location.getLatitude(), lng = location.getLongitude();
        final String endpoint = apiUrl + "/driver/location";
        final String auth = token, session = sessionId;
        network.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(endpoint).openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(12000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("Authorization", "Bearer " + auth);
                JSONObject body = new JSONObject();
                body.put("lat", lat); body.put("lng", lng); body.put("sessionId", session);
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream out = connection.getOutputStream()) { out.write(bytes); }
                int status = connection.getResponseCode();
                if (status == 403) {
                    // The backend rejects a superseded device session. Never keep
                    // broadcasting an old device's location after that response.
                    stopSelf();
                }
            } catch (Exception ignored) {
                // The next GPS update retries naturally after temporary network loss.
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Driver location", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shown while Zana Driver is online and sharing location.");
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
    }

    private void stopTracking() {
        try { if (locationManager != null) locationManager.removeUpdates(this); } catch (Exception ignored) {}
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().clear().apply();
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
    }

    @Override public void onDestroy() {
        stopTracking();
        network.shutdown();
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
}
