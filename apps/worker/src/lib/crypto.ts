import crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const algorithm = 'aes-256-cbc';
// Ensure a 32-byte key is used. If ENCRYPTION_KEY is not set or not 32 bytes, fallback to a default (for local dev only).
const rawKey = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_32_byte';
// Pad or truncate to 32 bytes
const secretKey = Buffer.from(rawKey.padEnd(32, '0').slice(0, 32));

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(hash: string): string {
  if (!hash || !hash.includes(':')) return hash; // Return as-is if it doesn't look like an encrypted hash
  
  const [ivHex, encryptedHex] = hash.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]);
  return decrypted.toString();
}
