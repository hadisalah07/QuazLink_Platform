import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { env } from './config/env.js';
import { tvRoutes } from './routes/tv.routes.js';
import { deviceRoutes } from './routes/device.routes.js';
import { haService } from './services/homeAssistant.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const downloadsDir = path.join(projectRoot, 'downloads');

// Ensure directories exist
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

const fastify = Fastify({
  logger: true
});

// Global Error Handler
fastify.setErrorHandler((error: any, _request, reply) => {
  fastify.log.error(error);
  reply.status(500).send({
    success: false,
    error: error?.message || 'Internal Server Error'
  });
});

// Start Server
const start = async () => {
  try {
    await fastify.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    });

    // Register static file serving for preview and downloads
    await fastify.register(fastifyStatic, {
      root: publicDir,
      prefix: '/static/'
    });

    // Dedicated static for downloads
    await fastify.register(fastifyStatic, {
      root: downloadsDir,
      prefix: '/downloads/',
      decorateReply: false
    });

    // Quick routes for simulator and TV download
    fastify.get('/preview', (_req, reply) => {
      return reply.sendFile('preview.html', publicDir);
    });

    fastify.get('/tv', (_req, reply) => {
      return reply.sendFile('download.html', publicDir);
    });

    fastify.get('/download', (_req, reply) => {
      return reply.sendFile('download.html', publicDir);
    });

    // Health check endpoint
    fastify.get('/api/health', async () => {
      const haStatus = await haService.ping();
      return {
        status: 'online',
        timestamp: Date.now(),
        gateway: 'QuazHome Fastify Gateway v1.0',
        homeAssistant: haStatus
      };
    });

    // Register TV and Device routes
    await fastify.register(tvRoutes, { prefix: '/api/tv' });
    await fastify.register(deviceRoutes, { prefix: '/api/device' });

    const address = await fastify.listen({ port: env.PORT, host: env.HOST });
    console.log(`\n======================================================`);
    console.log(`🚀 QuazHome Gateway running at: ${address}`);
    console.log(`🎮 TV PC Interactive Preview:  ${address}/preview`);
    console.log(`📥 TV Download Portal:         ${address}/tv`);
    console.log(`📺 TV Quick Menu API:          ${address}/api/tv/quick-menu`);
    console.log(`🩺 Health & HA Ping:           ${address}/api/health`);
    console.log(`======================================================\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
