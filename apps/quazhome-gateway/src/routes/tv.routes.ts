import { FastifyInstance } from 'fastify';
import { getTvQuickMenuHandler } from '../controllers/tv.controller.js';

export async function tvRoutes(fastify: FastifyInstance) {
  fastify.get('/quick-menu', getTvQuickMenuHandler);
}
