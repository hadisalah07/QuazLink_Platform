# QuazHome Fastify Gateway 🚀

Ultra-fast TypeScript API Gateway connecting **Home Assistant** to **QuazHome Android TV App** and other clients (React / Flutter), themed with the signature **QuazLink** design tokens (`#22D3EE` Cyan, `#8B5CF6` Purple, `#0A0E1A` Background).

---

## ⚡ Quick Start

### 1. Install & Configure
```bash
npm install
cp .env.example .env
```
Edit `.env` with your Home Assistant details:
```env
PORT=3001
HOST=0.0.0.0
HA_BASE_URL=http://<HA_IP>:8123
HA_ACCESS_TOKEN=<YOUR_LONG_LIVED_ACCESS_TOKEN>
```

### 2. Run in Development Mode
```bash
npm run dev
```

### 3. Build & Run Production
```bash
npm run build
npm start
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck and ping to Home Assistant Core |
| `GET` | `/api/tv/quick-menu` | Returns curated TV favorites with live states |
| `POST` | `/api/device/toggle` | Toggles light / switch (`{"entityId": "light.xxx"}`) |
| `POST` | `/api/device/climate/set-temp` | Sets AC target temp (`{"entityId": "climate.xxx", "temperature": 23}`) |
| `POST` | `/api/device/scene/trigger` | Triggers a scene (`{"sceneId": "scene.xxx"}`) |

---

## 🛠️ Customizing TV Favorites
Edit `src/config/tv-devices.json` to change rooms, device names, or order without re-compiling the Android TV app!
