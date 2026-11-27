package com.netstate.gardenersfriend;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Gardener's Friend phone app. Registers the app's own plugin (GfTls: HTTPS to the PC, pinned to its key).
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GfTlsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
