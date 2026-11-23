package com.washly.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.List;

/**
 * Google Play Billing untuk langganan WASHLY PRO.
 *
 * Aplikasi TIDAK memutuskan sendiri apakah pembelian sah: token pembelian dikirim ke server (Cloud Function playVerify),
 * yang memverifikasinya ke Google Play Developer API, mengakui (acknowledge) pembelian, lalu memperbarui hak akses akun.
 *
 *  - getProducts({productId})            → daftar base plan/offer beserta harga lokal dari Google Play
 *  - purchase({productId, basePlanId, accountId, offerId?, oldPurchaseToken?}) → alur pembelian Play
 *  - queryPurchases()                    → pembelian langganan aktif milik akun Google di perangkat (untuk "Pulihkan pembelian")
 *  - manage({productId})                 → halaman kelola/batalkan langganan di Google Play
 *  - event "purchasesUpdated"            → pembelian yang selesai belakangan (mis. pembayaran tertunda)
 */
@CapacitorPlugin(name = "WashlyBilling")
public class WashlyBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient client;
    private PluginCall pendingPurchase;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
    }

    @Override
    protected void handleOnDestroy() {
        if (client != null) client.endConnection();
    }

    private interface Ready { void run(); }

    private void whenReady(final PluginCall call, final Ready r) {
        if (client.isReady()) { r.run(); return; }
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult res) {
                if (res.getResponseCode() == BillingClient.BillingResponseCode.OK) r.run();
                else call.reject("Google Play Billing tidak tersedia: " + res.getDebugMessage(), String.valueOf(res.getResponseCode()));
            }
            @Override public void onBillingServiceDisconnected() { /* koneksi ulang otomatis (enableAutoServiceReconnection) */ }
        });
    }

    private void queryProduct(final PluginCall call, final String productId, final ProductReady cb) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId).setProductType(BillingClient.ProductType.SUBS).build()))
                .build();
        client.queryProductDetailsAsync(params, (res, result) -> {
            List<ProductDetails> list = result.getProductDetailsList();
            if (res.getResponseCode() != BillingClient.BillingResponseCode.OK || list == null || list.isEmpty()) {
                call.reject("Produk langganan tidak ditemukan di Google Play: " + productId + " (" + res.getDebugMessage() + ")");
                return;
            }
            cb.ready(list.get(0));
        });
    }
    private interface ProductReady { void ready(ProductDetails pd); }

    @PluginMethod
    public void getProducts(final PluginCall call) {
        final String productId = call.getString("productId", "washly_pro");
        whenReady(call, () -> queryProduct(call, productId, pd -> {
            JSArray offers = new JSArray();
            List<ProductDetails.SubscriptionOfferDetails> det = pd.getSubscriptionOfferDetails();
            if (det != null) for (ProductDetails.SubscriptionOfferDetails o : det) {
                JSObject x = new JSObject();
                x.put("basePlanId", o.getBasePlanId());
                x.put("offerId", o.getOfferId());
                x.put("offerToken", o.getOfferToken());
                JSArray phases = new JSArray();
                List<ProductDetails.PricingPhase> ph = o.getPricingPhases().getPricingPhaseList();
                for (ProductDetails.PricingPhase p : ph) {
                    JSObject j = new JSObject();
                    j.put("formattedPrice", p.getFormattedPrice());
                    j.put("priceMicros", p.getPriceAmountMicros());
                    j.put("currency", p.getPriceCurrencyCode());
                    j.put("billingPeriod", p.getBillingPeriod());
                    j.put("cycles", p.getBillingCycleCount());
                    phases.put(j);
                }
                ProductDetails.PricingPhase last = ph.get(ph.size() - 1); // harga berulang setelah fase promo/uji coba
                x.put("formattedPrice", last.getFormattedPrice());
                x.put("priceMicros", last.getPriceAmountMicros());
                x.put("billingPeriod", last.getBillingPeriod());
                x.put("phases", phases);
                offers.put(x);
            }
            JSObject ret = new JSObject();
            ret.put("productId", pd.getProductId());
            ret.put("title", pd.getName());
            ret.put("offers", offers);
            call.resolve(ret);
        }));
    }

    @PluginMethod
    public void purchase(final PluginCall call) {
        final String productId = call.getString("productId", "washly_pro");
        final String basePlanId = call.getString("basePlanId");
        final String offerId = call.getString("offerId");
        final String accountId = call.getString("accountId");
        final String oldToken = call.getString("oldPurchaseToken");
        if (basePlanId == null || accountId == null) { call.reject("basePlanId dan accountId wajib"); return; }
        if (pendingPurchase != null) { call.reject("Pembelian lain sedang berlangsung"); return; }
        whenReady(call, () -> queryProduct(call, productId, pd -> {
            String token = null;
            List<ProductDetails.SubscriptionOfferDetails> det = pd.getSubscriptionOfferDetails();
            if (det != null) for (ProductDetails.SubscriptionOfferDetails o : det) {
                if (!basePlanId.equals(o.getBasePlanId())) continue;
                boolean match = offerId == null ? o.getOfferId() == null : offerId.equals(o.getOfferId());
                if (match) { token = o.getOfferToken(); break; }
            }
            if (token == null) { call.reject("Paket " + basePlanId + " belum aktif di Google Play."); return; }
            BillingFlowParams.Builder b = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(pd).setOfferToken(token).build()))
                    // menautkan pembelian ke akun WASHLY (diverifikasi server, bukan dipercaya dari aplikasi)
                    .setObfuscatedAccountId(accountId);
            if (oldToken != null && !oldToken.isEmpty()) {
                b.setSubscriptionUpdateParams(BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                        .setOldPurchaseToken(oldToken)
                        .setSubscriptionReplacementMode(BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.WITH_TIME_PRORATION)
                        .build());
            }
            pendingPurchase = call;
            call.setKeepAlive(true);
            final BillingFlowParams params = b.build();
            getActivity().runOnUiThread(() -> {
                BillingResult r = client.launchBillingFlow(getActivity(), params);
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    PluginCall c = pendingPurchase; pendingPurchase = null;
                    if (c != null) { c.setKeepAlive(false); c.reject("Google Play: " + r.getDebugMessage(), String.valueOf(r.getResponseCode())); }
                }
            });
        }));
    }

    @Override
    public void onPurchasesUpdated(BillingResult res, List<Purchase> purchases) {
        JSObject ret = new JSObject();
        ret.put("responseCode", res.getResponseCode());
        ret.put("purchases", toJs(purchases));
        PluginCall c = pendingPurchase; pendingPurchase = null;
        int code = res.getResponseCode();
        if (c != null) {
            c.setKeepAlive(false);
            if (code == BillingClient.BillingResponseCode.OK) c.resolve(ret);
            else if (code == BillingClient.BillingResponseCode.USER_CANCELED) { ret.put("canceled", true); c.resolve(ret); }
            else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) { ret.put("alreadyOwned", true); c.resolve(ret); }
            else c.reject("Pembelian Google Play gagal: " + res.getDebugMessage(), String.valueOf(code));
        } else if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            notifyListeners("purchasesUpdated", ret);   // mis. pembayaran tertunda yang baru selesai
        }
    }

    @PluginMethod
    public void queryPurchases(final PluginCall call) {
        whenReady(call, () -> client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (res, list) -> {
                    if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("Tidak dapat membaca pembelian: " + res.getDebugMessage()); return; }
                    JSObject ret = new JSObject(); ret.put("purchases", toJs(list)); call.resolve(ret);
                }));
    }

    @PluginMethod
    public void manage(final PluginCall call) {
        String productId = call.getString("productId", "washly_pro");
        Uri uri = Uri.parse("https://play.google.com/store/account/subscriptions?sku=" + Uri.encode(productId) + "&package=" + Uri.encode(getContext().getPackageName()));
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, uri); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i); call.resolve();
        } catch (ActivityNotFoundException e) { call.reject("Google Play tidak tersedia di perangkat ini"); }
    }

    private JSArray toJs(List<Purchase> list) {
        JSArray arr = new JSArray();
        if (list == null) return arr;
        for (Purchase p : list) {
            for (String pid : p.getProducts()) {
                JSObject j = new JSObject();
                j.put("productId", pid);
                j.put("purchaseToken", p.getPurchaseToken());
                j.put("orderId", p.getOrderId());
                j.put("acknowledged", p.isAcknowledged());
                j.put("autoRenewing", p.isAutoRenewing());
                j.put("purchaseState", p.getPurchaseState() == Purchase.PurchaseState.PURCHASED ? "PURCHASED" : p.getPurchaseState() == Purchase.PurchaseState.PENDING ? "PENDING" : "UNSPECIFIED");
                arr.put(j);
            }
        }
        return arr;
    }
}
