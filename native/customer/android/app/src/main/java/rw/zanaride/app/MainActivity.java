package rw.zanaride.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.PermissionRequest;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // No scrollbars or edge-glow in the WebView; content still scrolls.
        getBridge().getWebView().setVerticalScrollBarEnabled(false);
        getBridge().getWebView().setHorizontalScrollBarEnabled(false);
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);

        // See the driver app's MainActivity for why this extends Capacitor's
        // own chrome client instead of replacing it: doing otherwise breaks
        // every photo upload in the app (package photos, later a profile
        // picture) with no visible error.
        getBridge().getWebView().setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });
    }
}
