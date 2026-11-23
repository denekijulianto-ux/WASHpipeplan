package com.washly.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WashlyNativePlugin.class);
        registerPlugin(WashlyBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
