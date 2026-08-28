import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import 'dotenv/config';
import apiRoutes from './routes';
import { setupWebSocketGateway } from './ws/gateway';
import prisma from './prisma';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION (non-fatal):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION (non-fatal):', reason);
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
      // No Origin header = same-origin, curl, server-to-server, or WS upgrade — allow.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
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
  prisma.$connect()
    .then(() => console.log('✅ PostgreSQL Database Connected via Prisma.'))
    .catch((err) => console.warn('PostgreSQL Connect Notice (non-fatal):', err.message));
});
