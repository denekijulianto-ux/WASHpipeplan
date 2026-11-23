package com.washly.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.view.WindowManager;

import androidx.core.content.FileProvider;
import android.webkit.WebView;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Fitur Android untuk WASHLY:
 *  - print: laporan & gambar DED lewat dialog cetak Android (termasuk "Simpan sebagai PDF")
 *  - saveFile: simpan berkas (.json, .gpx, foto) ke lokasi pilihan pengguna (Storage Access Framework, tanpa izin penyimpanan)
 *  - openExternal: buka tautan web / email / telepon di aplikasi bawaan
 *  - shareFile: menu Bagikan Android (WhatsApp, e-mail, Drive) untuk berkas .json/.gpx
 *  - keepAwake: layar tetap menyala saat merekam jejak GPS
 */
@CapacitorPlugin(name = "WashlyNative")
public class WashlyNativePlugin extends Plugin {

    @PluginMethod
    public void print(final PluginCall call) {
        final String name = call.getString("name", "WASHLY");
        final String paper = call.getString("paper", "A4");
        final boolean landscape = Boolean.TRUE.equals(call.getBoolean("landscape", false));
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                WebView wv = getBridge().getWebView();
                final PrintDocumentAdapter base = wv.createPrintDocumentAdapter(name);
                PrintDocumentAdapter wrapped = new PrintDocumentAdapter() {
                    private boolean finished = false;
                    @Override public void onStart() { base.onStart(); }
                    @Override public void onLayout(PrintAttributes oldA, PrintAttributes newA, CancellationSignal cs, LayoutResultCallback cb, Bundle extras) { base.onLayout(oldA, newA, cs, cb, extras); }
                    @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor dest, CancellationSignal cs, WriteResultCallback cb) { base.onWrite(pages, dest, cs, cb); }
                    @Override public void onFinish() {
                        base.onFinish();
                        if (!finished) { finished = true; call.resolve(); }
                    }
                };
                PrintAttributes.MediaSize ms = "A3".equalsIgnoreCase(paper) ? PrintAttributes.MediaSize.ISO_A3 : PrintAttributes.MediaSize.ISO_A4;
                ms = landscape ? ms.asLandscape() : ms.asPortrait();
                PrintAttributes attrs = new PrintAttributes.Builder().setMediaSize(ms).setColorMode(PrintAttributes.COLOR_MODE_COLOR).build();
                pm.print(name, wrapped, attrs);
            } catch (Exception e) {
                call.reject("Cetak gagal: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = call.getString("fileName", "washly-berkas");
        String mime = call.getString("mimeType", "application/octet-stream");
        if (call.getString("data") == null) { call.reject("Data berkas kosong"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject ret = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            ret.put("saved", false);
            call.resolve(ret);
            return;
        }
        Uri uri = result.getData().getData();
        try {
            byte[] bytes = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
            try (OutputStream os = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (os == null) throw new Exception("Tidak dapat menulis ke lokasi ini");
                os.write(bytes);
            }
            ret.put("saved", true);
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal menyimpan: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("URL kosong"); return; }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Tidak ada aplikasi untuk membuka tautan ini");
        }
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        String fileName = call.getString("fileName", "washly-berkas").replaceAll("[\\/:*?\"<>|]", "_");
        String mime = call.getString("mimeType", "application/octet-stream");
        String data = call.getString("data");
        if (data == null) { call.reject("Data berkas kosong"); return; }
        try {
            File dir = new File(getContext().getCacheDir(), "share");
            if (!dir.exists() && !dir.mkdirs()) throw new Exception("Folder sementara tidak dapat dibuat");
            File out = new File(dir, fileName);
            try (FileOutputStream os = new FileOutputStream(out)) { os.write(Base64.decode(data, Base64.DEFAULT)); }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", out);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            String title = call.getString("title");
            if (title != null) { send.putExtra(Intent.EXTRA_SUBJECT, title); }
            String text = call.getString("text");
            if (text != null) { send.putExtra(Intent.EXTRA_TEXT, text); }
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Bagikan " + fileName);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal membagikan: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void keepAwake(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }
}
