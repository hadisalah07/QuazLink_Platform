import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import 'dotenv/config';
import apiRoutes from './routes';
import { setupWebSocketGateway } from './ws/gateway';

const app = express();
const port = process.env.PORT || 3001;

// Credentialed CORS: a wildcard origin ('*') is INCOMPATIBLE with cookies, so
// the browser would silently drop the session cookie. Echo the exact web
// origin and allow credentials instead.
const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: webOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Basic health check (public — no auth).
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Mount all API routes
app.use('/api', apiRoutes);

// Create HTTP & WebSocket server instance
const server = http.createServer(app);
setupWebSocketGateway(server);

server.listen(port, () => {
  console.log(`🚀 API Server & WSS Gateway running on http://localhost:${port}`);
});
