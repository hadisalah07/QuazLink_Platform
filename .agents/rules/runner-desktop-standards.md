# Rule: QuazLink Desktop Runner Engineering & Release Standards

This rule governs ALL work, improvements, bug fixes, and feature additions across the **QuazLink Desktop Runner** (`apps/desktop-agent`).

---

## 1. Zero-Trust WebSocket Architecture
- The runner must communicate securely with `wss://api.quazlink.site` (or configured gateway).
- Always maintain ping/pong heartbeat interval (30s) and exponential backoff reconnection.
- Validate incoming job payloads strictly before dispatching to Playwright executor.

## 2. Windows Auto-Launch & Silent Boot Protocol
- Auto-launch via `app.setLoginItemSettings` must always pass `args: ['--hidden']`.
- When booted with `--hidden`, the window must remain hidden, starting quietly in the system tray.
- Both Tray menu and UI dashboard must synchronize the auto-launch state dynamically.

## 3. GitHub Releases & Redirect Host Whitelisting
- When downloading release assets from GitHub, ALWAYS allow both `objects.githubusercontent.com` AND `release-assets.githubusercontent.com`.
- Redirection without matching host whitelist will trigger security violations and abort updates.

## 4. Mandatory Pre-Release Build Gate
- Always run `npx tsc --noEmit` in `apps/desktop-agent` to verify TypeScript types before compiling.
- Build output via `npm run build`.
- Binary packaging via `npm run dist:exe`.
- Release asset verification: Ensure setup exe and patch zip exist and are functional before updating server manifest endpoints.

## 5. Self-Learning Knowledge Update
- Any new architectural bug fix or critical lesson MUST be recorded in `apps/desktop-agent/RUNNER_AGENT_KNOWLEDGE.md`.

