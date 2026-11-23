# WASHLY for Android — build, signing & update guide

WASHLY (*Simplify the Flow.*) is packaged for Android with **Capacitor 8**. This is the same WASHLY web app (same UI, same Firebase backend, same calculations), running inside a native Android shell.

| Item | Value |
|---|---|
| Application ID (package name) | `com.washly.app` (debug builds: `com.washly.app.debug`) |
| App name | WASHLY |
| Version | `versionName 1.3.0`, `versionCode 4` (in `android/app/build.gradle`) |
| minSdk / targetSdk / compileSdk | 24 (Android 7.0) / 36 (Android 16) / 36 |
| Web assets | `www/` (generated — never edit by hand) |
| Native shell | `android/` (Gradle project, open it in Android Studio) |

## How it fits together

```
src/index.dev.html ──node build.js──▶ index.html (web / GitHub Pages)
                                          │
                     node scripts/build-android.js
                                          ▼
                                   www/  (React, Leaflet, Firebase SDK, fonts, Tailwind CSS
                                          all bundled locally — no CDN — so the app opens offline)
                                          │  npx cap sync android
                                          ▼
                     android/app/src/main/assets/public  ──Gradle──▶ APK / AAB
```

* `mobile/native-shim.js` is loaded only inside the Android app. It connects the web app to Android:
  * **Cetak laporan / Cetak DED** use the Android print dialog, which includes *Save as PDF*.
  * **Unduh .json / foto** use the Android "Save to…" file picker. No storage permission is needed.
  * **Bagikan .json / .gpx** use the Android share sheet (WhatsApp, e-mail, Drive…).
  * **External links / e-mail links** open in the browser or the e-mail app.
  * **The Back button** closes the open dialog or panel first, then returns to the *Peta* tab. Pressing it twice exits the app.
  * **While a GPS track is being recorded**, the screen stays on.
  * **On resume from the background**, the app re-syncs with the cloud.
* `android/app/src/main/java/com/washly/app/WashlyNativePlugin.java` is the native side of the features above.
* The web version (GitHub Pages) is unchanged by all of this.

## 1. One-time setup on your computer

1. Install **Node.js 20+** and **Android Studio** (current stable). Android Studio includes the JDK 21 and the Android SDK.
2. In Android Studio, open **SDK Manager** and install:
   * *Android SDK Platform 36*
   * *Android SDK Build-Tools 36*
   * *Android SDK Platform-Tools*
3. In the project folder, run:
   ```bash
   npm install
   ```

## 2. Build the debug APK (for testing)

```bash
npm run android:apk:debug
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`. It is signed with the Android debug key and installs alongside the release app as `com.washly.app.debug`.

## 3. Install the APK on an Android phone

**Option A — USB (recommended)**
1. On the phone: go to *Settings → About phone* and tap *Build number* 7 times. Then go to *Developer options* and turn on *USB debugging*.
2. Connect the phone by USB and run:
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

**Option B — copy the file**
1. Send the APK to the phone (Drive, WhatsApp, USB).
2. Open it. If asked, allow *Install unknown apps* for the app you opened it from.

## 4. Release signing (upload key)

Google Play uses **Play App Signing**: Google keeps the final app-signing key, and you sign every upload with your **upload key**.

* The upload key for WASHLY is `android-signing/washly-upload.jks`:
  * alias `washly-upload`
  * RSA 4096
  * valid until 2056
* Its passwords are in `android/keystore.properties`.
* **Both files are git-ignored and must never be committed or shared publicly.**
* Upload-key certificate SHA-256 (safe to share):
  `BE:B7:13:F7:2F:12:58:E8:08:36:63:05:E0:3E:38:8B:99:52:4E:38:94:20:D4:9F:B7:57:09:B2:D8:6D:82:4A`

**Back them up now.** Store the `.jks` file and its password in two safe places, for example a password manager plus an encrypted drive. If the upload key is lost, the Play Console account owner can request an upload-key reset from Google, which takes several days. Updates cannot be uploaded until that is done.

`android/app/build.gradle` reads the key from `android/keystore.properties`:
```properties
storeFile=../android-signing/washly-upload.jks
storePassword=…
keyAlias=washly-upload
keyPassword=…
```
Alternatively, set the environment variables `WASHLY_KEYSTORE_FILE`, `WASHLY_KEYSTORE_PASSWORD`, `WASHLY_KEY_ALIAS` and `WASHLY_KEY_PASSWORD`. This suits CI, with the values stored as CI secrets. If no key is found, the release build is produced **unsigned** and Gradle prints a warning.

To create a *new* upload key yourself (only if you do not use the provided one, and before the first upload):
```bash
keytool -genkeypair -v -keystore android-signing/washly-upload.jks -storetype PKCS12 -alias washly-upload -keyalg RSA -keysize 4096 -validity 10950
```

## 5. Build the release AAB (Google Play) and release APK

```bash
npm run android:aab           # → android/app/build/outputs/bundle/release/app-release.aab
npm run android:apk:release   # → android/app/build/outputs/apk/release/app-release.apk (signed, for sideload testing)
```
To check the signature:
```bash
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

You can also build from Android Studio: run `npm run build:android`, then `npx cap open android`, then *Build → Generate Signed App Bundle / APK*.

## 6. Updating the app later

1. Change the app as usual in `src/index.dev.html`.
2. Bump the version in `android/app/build.gradle`:
   * `versionCode` must go **up by at least 1** on every Play upload (1 → 2 → 3…);
   * `versionName` is the label users see (1.0.0 → 1.0.1 / 1.1.0).
3. Run:
   ```bash
   npm run android:aab
   ```
4. Upload the new `app-release.aab` in Play Console, to a testing track or production, and add release notes.
5. Keep using the **same upload key**.

If you change the logo, regenerate the icons and splash:
```bash
npm run android:assets
```
This reads `assets/brand/washly-logo-source.png`. For sharper icons, replace it with a high-resolution or vector export of the logo, keeping the same layout.

## 7. Firebase notes (backend unchanged)

* The app runs at the origin `https://localhost` inside Android.
* Email/password login and Firestore work from this origin. `localhost` is in Firebase *Authorized domains* by default. Check *Firebase Console → Authentication → Settings → Authorized domains*.
* If the Firebase **API key has HTTP-referrer restrictions** in Google Cloud Console, add `https://localhost/*`. Otherwise login fails in the app.
* Publish the updated `firestore.rules`. It allows a user to delete their own `users/{uid}` document, which the in-app **Hapus akun** feature needs.

## 8. Known limitations

* **GPS tracking** runs while the app is open (the screen is kept on during recording). It does not record in the background.
* **Printing / PDF.** The paper size is preset: A4 portrait for the report, A3/A4 landscape for DED. You can change it in the Android print dialog.
* **The AI assistant** (optional, with the user's own Anthropic key) and **maps, elevation and search** need internet access. Everything else works offline, and sync resumes when the connection returns.
