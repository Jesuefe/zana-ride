package rw.zanaride.driver;

import android.os.Bundle;
import android.webkit.PermissionRequest;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must run before super.onCreate() — that's when Capacitor's
        // bridge actually initializes, and a plugin registered after that
        // point is simply never wired in, with no error to say so.
        registerPlugin(MapboxNavigationPlugin.class);

        super.onCreate(savedInstanceState);

        // Extend Capacitor's own chrome client rather than replacing it.
        // A bare android.webkit.WebChromeClient looks like it only affects
        // getUserMedia, but it silently drops onShowFileChooser() too —
        // every <input type="file"> in the app (pickup photos, drop-off
        // photos, document uploads) stops opening the camera or gallery,
        // with no error, because the tap has nothing to do. Extending
        // BridgeWebChromeClient keeps that behaviour and only adds the
        // auto-grant this app needs for voice calls.
        getBridge().getWebView().setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });
    }
}
