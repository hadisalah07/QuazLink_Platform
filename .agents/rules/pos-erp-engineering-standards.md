# Rule: QuazLink POS & ERP Engineering Standards & Release Protocol

This rule governs ALL work, improvements, bug fixes, and feature additions across the **QuazLink POS & ERP** desktop engine and related platform endpoints.

---

## 1. Dual-OS Compatibility Guarantee (Windows 7 + Windows 10/11)
- **Mandatory Dual Support**: Every feature, shortcut, UI modification, printer driver, or database call MUST support BOTH platforms:
  1. **Legacy Windows 7 SP1 / Windows 8 / POSReady 7**:
     - Support legacy virtual key codes (`keyCode` 187, 107, 189, 109, etc.) alongside modern `code`/`key` standards.
     - Support legacy Chromium/Node runtimes and WebAssembly SQLite polyfills without breaking.
     - Keep memory footprint lightweight for low-spec POS hardware (2GB RAM terminals).
  2. **Modern Windows 10 & Windows 11 (64-bit)**:
     - Full modern standard runtime, high-DPI scaling, hardware acceleration.
- **Never drop or compromise Windows 7 compatibility** unless the user explicitly and directly requests deprecating it.

---

## 2. Mandatory Build & Quality Verification Gate (اختبار وبناء إلزامي بعد كل مهمة)
- **Zero-Tolerance for Broken Builds**: After EVERY single task or improvement, the team MUST run local build tests:
  - `npm run build` in `apps/pos-client`
  - `node -c apps/pos-client/src/ui/app.js` (Mandatory syntax check for renderer Vanilla JS - prevents silent Chromium parse errors and frozen UI).
  - `npm run build` in `apps/api`
  - `npx tsc --noEmit` in `apps/web`
  - **Binary Freshness Check**: Ensure `dist/release/QuazLink-POS-Setup.exe` timestamp is newer than any modified source file.
- **Professionalism & Clean Architecture**: Code must be cleanly structured, well-documented, defensively programmed, and 100% free of TypeScript and runtime errors.
- **Security Guarantee (100% Secure)**:
  - No secrets or private keys leaked in client builds.
  - Proper SQL parameterization and ACID transaction commits in SQLite and PostgreSQL.
  - Robust error handling with graceful offline fallbacks.

---

## 3. Prominent Version Number Visibility in UI (إظهار رقم الإصدار بوضوح للمستخدم)
- The application MUST prominently display the running version number in the user interface:
  - **Header Bar**: A sleek, stylized badge next to the app brand/title (e.g., `v1.2.0`).
  - **Settings View**: Clear display under the "Updates & Releases" tab (`الإصدار الحالي: v1.2.0`).
  - **About / Status**: In all diagnostic and status summaries.
- The version badge must update dynamically from the server/client version config without manual hardcoding.

---

## 4. Semantic Version Bumping & Release Manifests (ترقيم الإصدارات لكل تحديث)
- Every released update MUST have a unique, incremented Semantic Version number (`major.minor.patch`, e.g., `1.2.0` -> `1.2.1` -> `1.3.0`).
- When a new version is released, the version number MUST be synchronized across all manifest files:
  1. `apps/pos-client/package.json`
  2. `apps/pos-client/src/services/updater-service.ts` (`CURRENT_VERSION`)
  3. `apps/pos-client/src/ui/index.html` (Header badge & settings badge)
  4. `apps/pos-client/src/services/google-drive-service.ts` (User-Agent header)
  5. `apps/api/src/routes/pos.ts` (`POS_LATEST_VERSION` + `POS_RELEASE_NOTES`)
  6. `apps/api/src/routes/downloads.ts` (API download manifests & CDN maps)
  7. `apps/web/src/app/api/pos/updates/route.ts` (`POS_LATEST_VERSION` + `POS_RELEASE_NOTES`)
  8. `apps/web/src/app/downloads/[filename]/route.ts` (Web download routes & fallback maps)
  9. `apps/web/src/app/pos/page.tsx` (Landing page direct download buttons: Setup & Portable)
  10. `apps/web/src/app/(dashboard)/download/page.tsx` (Dashboard downloads page)
  11. `apps/web/src/lib/translations.ts` (Arabic & English version strings)
  12. `apps/web/src/lib/version.ts` (`BUILD_ID` and release commit tag)
- **Grep Audit Requirement**: Always run a grep search for the previous version string across `apps/web` and `apps/pos-client` to ensure zero stale links or outdated badges remain before triggering release packaging.
- **Hotfix Bump Invariant**: If a distributed build has an issue, NEVER overwrite it with the same version number. Always bump the patch version (e.g. `1.3.1` -> `1.3.2`) so client terminals' auto-updater detects `semver.gt(remote, local)` and pulls the fix automatically.
- Clear, Arabic & English release notes describing the exact improvements must accompany each release.

---

## 5. Automated Customer Notification & In-App Update Rollout (إخطار العملاء المشغلين فوراً)
- Whenever a new version is published to production:
  - All running and booting POS clients query `https://app.quazlink.site/api/pos/updates`.
  - When `latestVersion > currentVersion`, the client MUST immediately trigger:
    1. **Top Floating Update Banner**: Prominent green banner on the main screen with release name and one-click install button.
    2. **Notification Badges**: Green indicator on the "Settings & Licensing" tab and the "Updates" subtab.
    3. **Actionable Toast Notification**: Prompting the cashier/owner to update.
  - The update process must preserve all local sales, offline invoices, and user configurations without data loss.
