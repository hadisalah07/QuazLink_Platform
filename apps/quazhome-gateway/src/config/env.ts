import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  HA_BASE_URL: z.string().url().default('http://192.168.1.100:8123'),
  HA_ACCESS_TOKEN: z.string().default('')
});

export const env = envSchema.parse(process.env);
