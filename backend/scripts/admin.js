import crypto from 'node:crypto';
import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
const args = Object.fromEntries(process.argv.slice(2).reduce((all, value, index, list) => value.startsWith('--') ? [...all, [value.slice(2), list[index + 1]]] : all, []));
const username = String(args.username || '').trim().toLowerCase(), name = String(args.name || '').trim(), password = String(args.password || '');
if (!/^[a-z0-9._-]{3,50}$/.test(username) || !name || password.length < 10) { console.error('Contoh: npm run admin -- --username admin --name "Nama Admin" --password "password-ku"'); process.exit(1); }
const pool = createPool(readConfig());
try { await pool.query('INSERT INTO admins (id,username,name,password_hash) VALUES ($1,$2,$3,$4) ON CONFLICT (username) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,active=true,failed_logins=0,locked_until=NULL', [crypto.randomUUID(), username, name, hashPassword(password)]); console.log('Admin ' + username + ' siap digunakan.'); } finally { await pool.end(); }
