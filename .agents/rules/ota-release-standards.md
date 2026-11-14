# Rule: Zero-Bug Release & OTA Deployment Standards

This rule governs ALL versioning, compilation, packaging, and over-the-air (OTA) update deployments across the QuazLink Platform (QuazHome TV, QuazLink POS, Desktop Runner, and Cloud APIs).

---

## 1. Permanent Cryptographic Keystore Continuity
- All Android APK builds MUST be signed exclusively with the permanent repository keystore (`apps/tv-client/app/release.jks`).
- Never generate temporary or transient keys (`keytool -genkeypair`) inside CI/CD workflows. Transient keys guarantee `INSTALL_FAILED_UPDATE_INCOMPATIBLE` ("App not installed as package conflicts with an existing package") and destroy user upgrade paths.
- Ensure V1, V2, V3, and V4 signing schemes are all enabled.

## 2. Dynamic Version Resolution (Zero Hardcoding)
- In client code (Kotlin/Java/Node/TS), NEVER hardcode version strings for update comparisons.
- In Android, dynamically query `packageManager.getPackageInfo(packageName, 0).versionName`.
- The version string in `build.gradle.kts` (`versionName` & `versionCode`) must match the server constant `TV_LATEST_VERSION` exactly.
- When `currentVersion == latestVersion`, the update API must return `hasUpdate: false`, and the client UI must completely hide the update prompt.

## 3. In-App PackageInstaller Robustness on Android TV
- Always check `context.packageManager.canRequestPackageInstalls()` before launching the APK installer.
- If unpermitted, launch `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` with `package:${context.packageName}` and inform the user via a Toast.
- Grant URI read permissions explicitly (`grantUriPermission`) to all resolved package installer activities.
- Provide `Intent.EXTRA_NOT_UNKNOWN_SOURCE = true` and `FLAG_GRANT_READ_URI_PERMISSION`.

## 4. Pre-Flight Verification Gate
Before communicating to the user that an update is ready:
1. GitHub Release is published and asset is uploaded.
2. VPS `/data/downloads/` has the exact matching binary file.
3. `curl -sI https://app.quazlink.site/downloads/<asset>` returns HTTP 200 with non-zero Content-Length.
4. Update API responds with `hasUpdate: true` for older versions, and `hasUpdate: false` for current version.
