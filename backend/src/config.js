import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export function readConfig() {
  const { DATABASE_URL, SESSION_SECRET, NODE_ENV = 'development' } = process.env;
  if (!DATABASE_URL) throw new Error('Isi DATABASE_URL di backend/.env. Jalankan npm run setup jika file belum ada.');
  if (!SESSION_SECRET || SESSION_SECRET.length < 32 || SESSION_SECRET.includes('DIISI_OTOMATIS')) {
    throw new Error('SESSION_SECRET harus acak dan minimal 32 karakter. Gunakan npm run setup.');
  }
  const origin = new URL(process.env.APP_ORIGIN || 'http://localhost:5173').origin;
  const production = NODE_ENV === 'production';
  if (production && !origin.startsWith('https://')) throw new Error('APP_ORIGIN produksi harus menggunakan HTTPS.');
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT tidak valid.');
  const trustProxy = Number(process.env.TRUST_PROXY || 0);
  if (![0, 1].includes(trustProxy)) throw new Error('TRUST_PROXY hanya boleh 0 atau 1.');
  return {
    connectionString: DATABASE_URL, secret: SESSION_SECRET, origin, production, port,
    host: process.env.HOST || '127.0.0.1', trustProxy,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false,
  };
}
