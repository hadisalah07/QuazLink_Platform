import { FastifyInstance } from 'fastify';
import {
  setClimateTempHandler,
  toggleDeviceHandler,
  triggerSceneHandler
} from '../controllers/device.controller.js';

export async function deviceRoutes(fastify: FastifyInstance) {
  fastify.post('/toggle', toggleDeviceHandler);
  fastify.post('/climate/set-temp', setClimateTempHandler);
  fastify.post('/scene/trigger', triggerSceneHandler);
}
