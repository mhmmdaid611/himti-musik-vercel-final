import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const file = new URL('../backend/.env', import.meta.url);
try { await fs.access(file); console.log('backend/.env sudah ada; tidak diubah.'); }
catch { const example = await fs.readFile(new URL('../backend/.env.example', import.meta.url), 'utf8'); await fs.writeFile(file, example.replace('DIISI_OTOMATIS_OLEH_NPM_RUN_SETUP', crypto.randomBytes(48).toString('base64url'))); console.log('backend/.env dibuat. Periksa DATABASE_URL, lalu lanjutkan npm run db:init.'); }
