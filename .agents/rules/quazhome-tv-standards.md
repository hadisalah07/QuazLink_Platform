# Rule: QuazHome Android TV & Smart Home Engineering Standards

This rule governs ALL architecture, code modifications, and integrations across the **QuazHome TV Client** (`apps/tv-client`) and the Smart Home IoT ecosystem (`apps/quazhome-gateway` & `apps/api/src/routes/tv.ts`).

---

## 1. Mandatory Pre-Work Research Gate (قاعدة البحث المسبق)
- Before implementing or modifying any Android TV permission, service, overlay, or Home Assistant integration, ALWAYS execute a real-time deep web search (`search_web`) targeting current Google Android TV / Android 14/15 changes and Home Assistant core specifications.
- Never rely on legacy mobile phone practices that break on Android TV D-Pad environments.

## 2. 100% Touchless D-Pad First UI
- Every clickable UI element on the TV MUST declare `android:focusable="true"` and `android:clickable="true"`.
- Focus visual feedback must be immediate and pronounced (QuazCyan Glow border or highlight background).
- Key events: support DPAD UP, DOWN, LEFT, RIGHT, CENTER (Enter/OK), and BACK consistently.

## 3. Remote Key Interception via Accessibility Service
- The Accessibility Service (`RemoteKeyInterceptorService`) must intercept the assigned smart home key (Blue key 134, Menu 82, or custom key).
- In `AndroidManifest.xml`, ALWAYS declare `android:exported="true"` alongside `android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"` to prevent the Android OS framework binder from dropping connection and snapping the toggle back to OFF.
- Wrap all `onKeyEvent` interception logic in rigorous try-catch blocks to prevent service crashes.

## 4. Non-Intrusive Floating Quick Menu Overlay
- Built using `WindowManager` with `TYPE_APPLICATION_OVERLAY` and `SYSTEM_ALERT_WINDOW`.
- Must float smoothly above active streaming video (YouTube, Netflix, IPTV) without freezing media decoding.
- Instant responsive toggling of lights, switches, scenes, and AC temperature controls.

## 5. Persistent Pairing and Credential Security
- All paired TV device tokens and encrypted Home Assistant long-lived tokens must be persisted in host-mounted volume `/data/tv_storage/tv_devices.json`.
- Never store pairing state inside ephemeral docker container layers.
