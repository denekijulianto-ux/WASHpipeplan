# WASHLY Android — test checklist (v1.0.0, versionCode 1)

Status key:
* **PASSED** — actually executed and verified.
* **FAILED** — executed and not working.
* **NOT TESTED** — still needs a real Android phone.

Where it was tested:
* **[B]** — Chromium phone emulation of the exact Android web bundle (`www/`), with all internet blocked, plus a simulated Capacitor bridge recording native calls.
* **[G]** — Gradle / Android SDK build tools.
* **[E]** — Android 14 emulator (software CPU, no hardware acceleration) running the real debug APK.

| # | Area | Test | Status | Notes |
|---|---|---|---|---|
| 1 | Build | Debug APK builds | PASSED [G] | `com.washly.app.debug`, 6.4 MB |
| 2 | Build | Release APK builds & is signed with upload key | PASSED [G] | apksigner v2 verified, cert SHA-256 `BEB713F7…824A` |
| 3 | Build | Release AAB builds & is signed | PASSED [G] | `jarsigner -verify` OK; no native `.so` (16 KB page rule N/A) |
| 4 | Build | Manifest: package, version, SDK levels, permissions | PASSED [G] | com.washly.app, 1.0.0/1, min 24, target 36; INTERNET, NETWORK_STATE, FINE/COARSE LOCATION only |
| 5 | Startup | App bundle starts with **no internet** (all libs local) | PASSED [B] | No CDN requests; fonts, Tailwind, React, Leaflet, Firebase SDK local |
| 6 | Startup | Real APK launches on Android | see emulator section | |
| 7 | Layout | No horizontal overflow on phone width (all 5 tabs) | PASSED [B] | 412 px and 360 px wide |
| 8 | Auth (local mode) | Register / login / logout | PASSED [B] | |
| 9 | Auth (Firebase) | Register, login, logout, password reset against **production Firebase** | NOT TESTED | No access to production Firebase from the build machine. Test on a phone (§ manual). |
| 10 | Account | In-app account deletion: wrong password rejected; account, profile, projects & data removed; re-login refused | PASSED [B] | Local mode and Firebase code path (with test double). Needs the updated `firestore.rules` published. |
| 11 | Back button | Closes open dialog/menu | PASSED [B] | |
| 12 | Back button | From another tab returns to *Peta* | PASSED [B] | |
| 13 | Back button | Single press on *Peta* does not exit; second press within 2 s exits | PASSED [B] | |
| 14 | Files | *Unduh .json* → Android save dialog (SAF) | PASSED [B] (JS→native call) | Native dialog itself: NOT TESTED on device |
| 15 | Files | *Bagikan .gpx/.json* → Android share sheet | PASSED [B] (JS→native call) | Native share sheet: NOT TESTED on device |
| 16 | Print/PDF | *Cetak laporan* → print A4 portrait; *Cetak DED* → A3 landscape; screen restored afterwards | PASSED [B] (JS→native call) | Android print dialog / *Save as PDF* output: NOT TESTED on device |
| 17 | Links | External links & `mailto:` open in system apps | PASSED [B] (JS→native call) | |
| 18 | GPS | Keep screen on while recording track | PASSED [B] (JS→native call) | Real GPS accuracy: NOT TESTED |
| 19 | AI | "⚑ Laporkan jawaban" sends report to admin inbox | NOT TESTED | Needs an AI answer (user API key) |
| 20 | Web | Existing web version unchanged (regression suite) | PASSED [B] | Review/sign flow, owner lock, rebar/RAB, riser/report, sync |

## Manual tests still required on a real phone (internal testing track)

Install the debug APK (`adb install -r dist/WASHLY-1.0.0-debug.apk`) or join the internal-testing link.

1. Splash: W logo with "WASHLY — Simplify the flow", lasting under 1 s, then the app.
2. Register a new account. Check that the admin sees the pending account and approves it. Log in, log out, use *Lupa kata sandi*.
3. Location permission prompt when tapping GPS. Mark points. Record a track (the screen stays on).
4. Take an assessment photo with the camera; pick a photo from the gallery.
5. Calculators, hydraulics, pump curve, RAB and DED on a real phone. Rotate the screen.
6. *Cetak laporan* → *Save as PDF* → open the PDF. Do the same for *Cetak DED*.
7. *Unduh .json* → choose Downloads → open the file. *Bagikan .gpx* → WhatsApp / Drive.
8. Airplane mode: the app opens and edits work offline. Turn the network back on and check that the data syncs to the cloud and appears on a PC.
9. Background the app for a few minutes, then resume. The data refreshes.
10. Back button inside dialogs, the menu and the profile; double-press to exit.
11. Delete a test account from *Menu → Profil saya → Hapus akun*.
12. Android 7–9 phone (minSdk 24) if available, and an Android 15/16 phone (edge-to-edge).
