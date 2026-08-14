import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import 'dotenv/config';
import apiRoutes from './routes';
import { setupWebSocketGateway } from './ws/gateway';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:3000',
  'https://app.quazlink.site',
  'https://quazlink.site',
  process.env.WEB_ORIGIN,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.quazlink.site')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);
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

server.listen(Number(port), '0.0.0.0', () => {
  console.log(`🚀 API Server & WSS Gateway running on http://0.0.0.0:${port}`);
});
