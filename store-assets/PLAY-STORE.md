# WASHLY — Google Play publication kit

Everything here is a **draft prepared from the app's actual behaviour**. Items marked **[YOU]** need your decision, your account, or information only you have. Google Play rules change, so check each step against the current Play Console screens and Policy Center while you go.

## 1. Files

| What | File | Play requirement |
|---|---|---|
| App bundle | `android/app/build/outputs/bundle/release/app-release.aab` | AAB, signed with your upload key |
| App icon | `store-assets/play-icon-512.png` | 512×512 PNG |
| Feature graphic | `store-assets/feature-graphic-1024x500.png` (source: `feature-graphic.html`) | 1024×500 PNG/JPG |
| Phone screenshots | `store-assets/screenshots/01…06.png` | 2–8 images, 1080×1920 (9:16) |

The screenshots are drafts made from the app's sample project. **[YOU]** Before publishing, consider replacing them with screenshots from a real phone, logged in to a real (non-sample) project:
* `01-masuk.png` shows the *local-mode* login note; the production app shows "Akun baru aktif setelah disetujui admin organisasi".
* `02-peta-jaringan.png` has no satellite basemap, because the build machine had no map access.

## 2. Store listing

**App name** (max 30): `WASHLY: Simplify the Flow`
(or just `WASHLY`)

**Short description** (max 80)
* ID: `Perencanaan jaringan air bersih: GPS, hidrolis, RAB & gambar DED.`
* EN: `Water network planning: GPS mapping, hydraulics, cost estimate & drawings.`

**Full description (ID)**
```
WASHLY — Simplify the Flow.
Alat kerja teknis untuk perencanaan air bersih, sanitasi, dan rekayasa jaringan pipa.

• Pemetaan & asesmen lapangan: tandai titik dengan GPS, rekam jejak jalur pipa, foto asesmen berkoordinat, impor/ekspor GPX.
• Analisis hidrolis: debit, kecepatan, kehilangan tekan (Hazen-Williams), sisa tekanan, profil elevasi jalur.
• Pompa & pengolahan air: desain sumur bor, kurva pompa, pipa riser, daya motor, filter & IPA.
• BoQ & RAB: volume otomatis, harga satuan per provinsi (SHS), spesifikasi bahan minimal/ideal/maksimal.
• Gambar DED: denah, potongan, reservoir, broncaptering, menara air, jembatan pipa, detail penulangan, fitting — siap cetak/PDF.
• Kerja tim: sinkron cloud otomatis antara HP dan PC, review & tanda tangan elektronik pemeriksa/penyetuju.
• Bekerja tanpa sinyal di lapangan; data tersinkron saat online kembali.
• Asisten teknis (luring) dengan opsi AI memakai kunci API Anda sendiri.

Akun baru aktif setelah disetujui admin organisasi.
```

**Full description (EN)**
```
WASHLY — Simplify the Flow.
A field-to-design tool for clean-water, sanitation and pipeline engineering.

• Field mapping: GPS points, route tracking, geotagged survey photos, GPX import/export.
• Hydraulics: flow, velocity, head loss (Hazen-Williams), residual pressure, elevation profile.
• Pumps & treatment: borehole design, pump curve, riser pipe, motor power, filters.
• Bill of quantities & cost estimate with regional unit prices.
• Detailed engineering drawings (layout, sections, reservoirs, water towers, pipe bridges, rebar details) — print or save as PDF.
• Teamwork: automatic phone↔PC cloud sync, review workflow with e-signatures.
• Works offline in the field; syncs when back online.
New accounts become active after approval by an organisation admin.
```

* **Category:** *Productivity*. Alternatives: *Tools*, *Business*. **[YOU]** pick one.
* **Tags:** engineering, water, maps, productivity.
* **Contact e-mail (required):** `washlywater@gmail.com`
* **Website:** `https://denekijulianto-ux.github.io/WASHpipeplan/` (optional).
* **Privacy policy URL (required):** `https://denekijulianto-ux.github.io/WASHpipeplan/privacy.html` (completed; check the page opens before entering it).

## 3. App content declarations (Play Console → Policy → App content)

| Declaration | Suggested answer (verify) | Why |
|---|---|---|
| Privacy policy | URL above | Required |
| Ads | **No ads** | No ad SDKs in the app |
| App access | **All or some functionality is restricted** → give reviewer login | Login + admin approval required |
| Content rating | IARC questionnaire, see §5 | Required |
| Target audience | **18+** (or 16–17 and 18+) | Professional tool; avoids Families policy |
| News app | No | |
| COVID-19 apps | No | |
| Data safety | See §4 | Required |
| Government app | **[YOU]** "Yes" only if published on behalf of a government body | |
| Financial features | None | |
| Health | None | |
| Account deletion | In-app: *Menu → Profil saya → Hapus akun*; web URL: `…/WASHpipeplan/hapus-akun.html` | Required when users can create accounts |

**App access instructions (example).**
* **[YOU]** Create a dedicated reviewer account in the production Firebase project and **approve it as admin** (Menu → Kelola pengguna). Unapproved accounts cannot open projects.
* Give the reviewer the e-mail and password, plus:
  > Login with the credentials above. The account is pre-approved. To see features quickly: Menu → "Proyek baru dari contoh" opens a sample water-network project. Tabs: Peta (map), Hidrolis, Olah Air, RAB, DED.

## 4. Data safety (Play Console → Data safety) — checklist

**Overall answers**
* Collects or shares required user data types: **Yes**.
* Data is encrypted in transit: **Yes** (HTTPS / Firebase).
* Users can request data deletion: **Yes** (in-app + web page).

**Data types collected.** None of these are *sold* or used for ads or analytics.

| Category → type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Personal info → **Name** | Yes | No | Required | Account management, App functionality |
| Personal info → **Email address** | Yes | No | Required | Account management, App functionality |
| Personal info → **Phone number** | Yes | No | Optional | Account management |
| Personal info → **Address** (staff profile) | Yes | No | Optional | App functionality |
| Personal info → **Other info** (role, organisation, assignment history) | Yes | No | Optional | App functionality |
| Location → **Precise location** | Yes | **Yes** (note A) | Optional (GPS features) | App functionality |
| Photos and videos → **Photos** (survey photos, profile photo, signatures) | Yes | No | Optional | App functionality |
| Files and docs (project files, drawings) | Yes | No | Required for cloud sync | App functionality |
| App activity → **Other user-generated content** (projects, review notes, AI reports) | Yes | **Yes** (note B) | — | App functionality |
| Messages → **Other in-app messages** (notifications inbox) | Yes | No | — | App functionality |

**Notes**
* **Note A.** When the elevation profile / DEM features are used, the coordinates of network points are sent to *Open-Meteo*, and OpenStreetMap services are queried for the map area. Google treats transfers to service providers that process data on your behalf, and user-initiated transfers the user would expect, as *not* "sharing". **Decision: declare Location → shared → App functionality.**
* **Note B.** The optional AI mode sends the user's questions plus a project summary to *Anthropic*, using the **user's own API key**, only after the user turns it on. **Decision: declare it as shared ("Other user-generated content → App functionality").**
* **Not collected:** device IDs, analytics, crash logs, contacts, financial info, health, audio, web history.
* Location is **not** collected in the background.

## 5. Content rating (IARC questionnaire) — expected answers

* **Category:** *All other app types* (utility / productivity / reference).
* Violence, sexuality, language, controlled substances, gambling: **No**.
* **Do users interact or exchange content?** **Yes**: team members share projects, notes and notifications (accounts are approved by an admin).
* **Shares user location with other users?** **Yes**: project coordinates are visible to approved team members.
* **Digital purchases:** **No**.
* **Generative AI features:** the optional AI assistant generates text. The app has an in-app **"⚑ Laporkan jawaban"** button on AI answers, which sends the report to the admins, as Google's AI-generated content policy requires.

Expected result: rated for everyone or teens. The final rating is issued by IARC.

## 6. Permissions declaration

| Permission | Why | Play declaration needed? |
|---|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | Login, sync, maps | No |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | GPS mapping, only while in use | No *background*-location declaration needed. Mention location use in the description and privacy policy (done). |
| Camera / files | Through the system camera app and file picker; no permission requested | No |

* No `ACCESS_BACKGROUND_LOCATION`, `READ_MEDIA_*`, `MANAGE_EXTERNAL_STORAGE`, SMS, call log, `QUERY_ALL_PACKAGES` or exact alarms.
* **Billing:** WASHLY has **no purchases or subscriptions**, so Google Play Billing is not needed. If you add paid features later, digital goods sold in the app must use Play Billing.

## 7. Version & release notes

* `versionName 1.0.0` / `versionCode 1`, targetSdk 36 (Android 16), minSdk 24 (Android 7.0).
* Release notes (ID): `Rilis pertama WASHLY untuk Android: pemetaan GPS, analisis hidrolis, pompa & pengolahan air, RAB, gambar DED, sinkron cloud HP↔PC, dan bekerja tanpa sinyal.`
* Release notes (EN): `First Android release of WASHLY: GPS mapping, hydraulics, pumps & treatment, cost estimates, engineering drawings, phone↔PC cloud sync and offline field work.`

---

## 8. Step-by-step: publishing WASHLY

1. **Developer account.**
   * Go to <https://play.google.com/console> and sign up. You need a one-time registration fee and identity verification.
   * Choose **Organization** (needs a D-U-N-S number) or **Personal**.
   * **Personal accounts created after Nov 2023 must run a closed test** before production; see step 11.
2. **Create the app.** Play Console → *Create app*:
   * name *WASHLY*;
   * default language *Indonesian (id-ID)*;
   * *App*;
   * *Free*;
   * accept the declarations.
3. **App details.** *Grow → Store presence → Main store listing*: name, short and full description (§2). Add an English translation if wanted.
4. **Upload the AAB.**
   * Go to *Test and release → Testing → Internal testing → Create new release*.
   * Accept **Play App Signing** (Google-managed key).
   * Upload `app-release.aab`, then *Save*.
   * Play Console shows the **app-signing key SHA-256**. Keep it; you only need it if you later add Google sign-in or Firebase Android apps.
5. **Store listing graphics.** Upload the icon (512), the feature graphic (1024×500), and 2–8 phone screenshots (§1). Tablet screenshots are optional.
6. **Screenshots.** As in step 5. Real-device captures from a real project look best.
7. **Privacy policy.** Finish `privacy.html` and `hapus-akun.html` (fill in the [ISI] fields), commit and push. Open the GitHub Pages URL, then paste it under *Policy → App content → Privacy policy*.
8. **Data safety.** Complete the form using §4, then review the generated summary.
9. **Content rating.** Complete the IARC questionnaire (§5) with your contact e-mail.
10. **Testing track.**
    * Add testers to **Internal testing** (up to 100 e-mails) and share the opt-in link.
    * Install from Play and run the test checklist (`store-assets/TEST-CHECKLIST.md`) on real phones.
11. **Tester requirement.**
    * If you have a **personal** developer account created after 13 Nov 2023, run a **closed test** with **at least 12 testers opted-in for 14 continuous days**.
    * Then apply for production access in the Dashboard. Google asks how you tested.
    * Organization accounts are exempt. Check the current numbers in Play Console.
12. **Submit for review.**
    * Go to *Production → Create new release* and add the same AAB (or promote it from testing).
    * Add release notes.
    * Choose countries (e.g. Indonesia).
    * *Review release → Start rollout*. The first review usually takes from a few days up to about a week.
13. **Publish.** When approved, the app goes live, or waits for you if you enabled *Managed publishing*. Later updates follow `ANDROID.md` §6: higher `versionCode`, same upload key.
