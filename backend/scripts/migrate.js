import fs from 'node:fs/promises';
import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
const pool = createPool(readConfig());
try { await pool.query(await fs.readFile(new URL('../sql/001_initial.sql', import.meta.url), 'utf8')); console.log('Database Himti Musik siap digunakan.'); }
catch (error) { if (error.code === '42P07') console.log('Database sudah pernah disiapkan.'); else throw error; }
finally { await pool.end(); }
