import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { haService } from '../services/homeAssistant.service.js';

const toggleSchema = z.object({
  entityId: z.string().min(3)
});

const climateTempSchema = z.object({
  entityId: z.string().min(3),
  temperature: z.number().min(16).max(32)
});

const sceneSchema = z.object({
  sceneId: z.string().min(3)
});

export async function toggleDeviceHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = toggleSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({
      success: false,
      error: 'Invalid entityId',
      details: parseResult.error.errors
    });
  }

  try {
    const result = await haService.toggleDevice(parseResult.data.entityId);
    return reply.send({
      success: true,
      entityId: parseResult.data.entityId,
      newState: result.newState
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      error: error.message
    });
  }
}

export async function setClimateTempHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = climateTempSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({
      success: false,
      error: 'Invalid climate parameters',
      details: parseResult.error.errors
    });
  }

  try {
    const result = await haService.setClimateTemperature(
      parseResult.data.entityId,
      parseResult.data.temperature
    );
    return reply.send({
      success: true,
      entityId: parseResult.data.entityId,
      targetTemp: result.targetTemp
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      error: error.message
    });
  }
}

export async function triggerSceneHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = sceneSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({
      success: false,
      error: 'Invalid sceneId',
      details: parseResult.error.errors
    });
  }

  try {
    await haService.triggerScene(parseResult.data.sceneId);
    return reply.send({
      success: true,
      sceneId: parseResult.data.sceneId
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      error: error.message
    });
  }
}
