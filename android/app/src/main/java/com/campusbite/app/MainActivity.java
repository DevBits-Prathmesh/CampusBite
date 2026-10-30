package com.campusbite.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.ionicframework.capacitor.Checkout;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Add the plugin before the bridge is created; Capacitor also auto-loads it
        // from capacitor.plugins.json after `npx cap sync android`.
        registerPlugin(Checkout.class);
        super.onCreate(savedInstanceState);
    }
}
