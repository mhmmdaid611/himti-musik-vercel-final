import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { readConfig } from './config.js';
import { createPool, transaction } from './db.js';
import { GROUPS, memberInput, completeMember, summary } from './validation.js';
import { safeUser, verifyPassword } from './auth.js';

const PgSession = connectPgSimple(session);
const publicMember = (row) => ({ id: row.id, groupId: row.group_id, groupName: row.group_name, name: row.name, status: row.status, process: row.process, updatedDate: row.updated_date });
const privateMember = (row) => ({ ...publicMember(row), phone: row.phone, notes: row.notes, revision: row.revision, createdAt: row.created_at });
const sameOrigin = (req, config) => !req.get('origin') || req.get('origin') === config.origin;
const sendError = (res, error, fallback = 'Perubahan gagal disimpan.') => res.status(error.status || (error.code === '23505' ? 409 : 400)).json({ error: error.code === '23505' ? 'Nomor WhatsApp sudah terdaftar.' : error.message || fallback });

async function publicData(pool) {
  const [members, groups] = await Promise.all([
    pool.query('SELECT m.*, g.name AS group_name FROM members m JOIN groups g ON g.id=m.group_id ORDER BY m.sequence'),
    pool.query('SELECT id, name, kol FROM groups ORDER BY id'),
  ]);
  return { groups: groups.rows, members: members.rows.map(publicMember), summary: summary(members.rows) };
}

export function createApp({ pool, config = readConfig() }) {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(session({ store: new PgSession({ pool, tableName: 'sessions', createTableIfMissing: false }), secret: config.secret, resave: false, saveUninitialized: false, rolling: true, cookie: { httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: 8 * 60 * 60 * 1000 } }));
  app.use('/api/admin/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use((req, res, next) => { if (req.method !== 'GET' && !sameOrigin(req, config)) return res.status(403).json({ error: 'Permintaan dari situs lain ditolak.' }); next(); });
  app.get('/api/public', async (req, res) => { try { res.json(await publicData(pool)); } catch { res.status(503).json({ error: 'Database belum tersedia.' }); } });
  app.get('/api/admin/me', (req, res) => res.json({ user: req.session.user || null }));
  app.post('/api/admin/login', async (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase(), password = String(req.body?.password || '');
    if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    try {
      const result = await pool.query('SELECT * FROM admins WHERE username=$1 AND active=true', [username]);
      const admin = result.rows[0], locked = admin?.locked_until && new Date(admin.locked_until) > new Date();
      if (!admin || locked || !verifyPassword(password, admin.password_hash)) {
        if (admin) await pool.query("UPDATE admins SET failed_logins=failed_logins+1, locked_until=CASE WHEN failed_logins+1 >= 5 THEN now()+interval '15 minutes' ELSE locked_until END WHERE id=$1", [admin.id]);
        return res.status(401).json({ error: 'Username atau password salah.' });
      }
      await pool.query('UPDATE admins SET failed_logins=0, locked_until=NULL WHERE id=$1', [admin.id]);
      req.session.regenerate((error) => { if (error) return res.status(500).json({ error: 'Sesi tidak dapat dibuat.' }); req.session.user = safeUser(admin); res.json({ user: req.session.user }); });
    } catch { res.status(503).json({ error: 'Database belum tersedia.' }); }
  });
  app.post('/api/admin/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
  app.use('/api/admin', (req, res, next) => { if (['/login', '/me', '/logout'].includes(req.path)) return next(); if (!req.session.user) return res.status(401).json({ error: 'Login admin diperlukan.' }); next(); });
  app.get('/api/admin/data', async (req, res) => {
    try {
      const [members, groups, events] = await Promise.all([pool.query('SELECT m.*, g.name AS group_name FROM members m JOIN groups g ON g.id=m.group_id ORDER BY m.sequence'), pool.query('SELECT id,name,kol FROM groups ORDER BY id'), pool.query('SELECT id,text,created_at FROM events ORDER BY created_at DESC,id DESC LIMIT 20')]);
      res.json({ user: req.session.user, groups: groups.rows, members: members.rows.map(privateMember), events: events.rows });
    } catch { res.status(503).json({ error: 'Database belum tersedia.' }); }
  });
  app.post('/api/admin/groups/kols', async (req, res) => {
    try {
      const kols = req.body?.groups;
      if (!Array.isArray(kols) || kols.length !== 2) throw new Error('Isi KOL untuk dua kelompok.');
      await transaction(pool, async (client) => { for (const group of kols) { if (!GROUPS.some((item) => item.id === group.id) || String(group.kol || '').length > 100) throw new Error('Data KOL tidak valid.'); await client.query('UPDATE groups SET kol=$1 WHERE id=$2', [String(group.kol || '').trim(), group.id]); } await client.query('INSERT INTO events (admin_id,text) VALUES ($1,$2)', [req.session.user.id, 'Data KOL diperbarui.']); });
      res.json({ ok: true });
    } catch (error) { sendError(res, error, 'KOL gagal disimpan.'); }
  });
  app.post('/api/admin/members', async (req, res) => {
    try {
      const input = memberInput(req.body?.member), id = req.body?.id;
      await transaction(pool, async (client) => {
        if (!id) { await client.query('INSERT INTO members (id,group_id,name,phone,status,process,updated_date,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [crypto.randomUUID(),input.groupId,input.name,input.phone,input.status,input.process,input.updatedDate,input.notes]); await client.query('INSERT INTO events (admin_id,text) VALUES ($1,$2)', [req.session.user.id, input.name + ' ditambahkan ke ' + GROUPS.find((group) => group.id === input.groupId).name + '.']); return; }
        const current = await client.query('SELECT * FROM members WHERE id=$1 FOR UPDATE', [id]);
        if (!current.rows[0]) throw Object.assign(new Error('Member tidak ditemukan.'), { status: 404 });
        if (Number(req.body.revision) !== current.rows[0].revision) throw Object.assign(new Error('Data member sudah berubah. Muat ulang.'), { status: 409 });
        if (input.groupId !== current.rows[0].group_id) throw new Error('Pindah kelompok harus menggunakan proses Transfer.');
        await client.query('UPDATE members SET name=$1,phone=$2,status=$3,process=$4,updated_date=$5,notes=$6,revision=revision+1 WHERE id=$7', [input.name,input.phone,input.status,input.process,input.updatedDate,input.notes,id]);
        await client.query('INSERT INTO events (admin_id,text) VALUES ($1,$2)', [req.session.user.id, input.name + ' diperbarui.']);
      });
      res.json({ ok: true });
    } catch (error) { sendError(res, error); }
  });
  app.post('/api/admin/members/complete', async (req, res) => {
    try {
      const { id, revision, targetGroup, date } = req.body || {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('Tanggal update tidak valid.');
      await transaction(pool, async (client) => {
        const current = await client.query('SELECT * FROM members WHERE id=$1 FOR UPDATE', [id]);
        if (!current.rows[0]) throw Object.assign(new Error('Member tidak ditemukan.'), { status: 404 });
        if (Number(revision) !== current.rows[0].revision) throw Object.assign(new Error('Data member sudah berubah. Muat ulang.'), { status: 409 });
        const next = completeMember(current.rows[0], targetGroup);
        let notes = current.rows[0].notes;
        if (current.rows[0].process === 'Transfer') notes = (notes + (notes ? '\n' : '') + '[' + date + '] Transfer: ' + current.rows[0].group_id + ' → ' + targetGroup).slice(-2000);
        await client.query('UPDATE members SET group_id=$1,status=$2,process=$3,updated_date=$4,notes=$5,revision=revision+1 WHERE id=$6', [next.groupId,next.status,next.process,date,notes,id]);
        await client.query('INSERT INTO events (admin_id,text) VALUES ($1,$2)', [req.session.user.id, current.rows[0].name + ': ' + current.rows[0].process + ' selesai.']);
      });
      res.json({ ok: true });
    } catch (error) { sendError(res, error, 'Proses gagal diselesaikan.'); }
  });
  app.post('/api/admin/import', async (req, res) => {
    try {
      const members = req.body?.members;
      if (!Array.isArray(members) || members.length < 1 || members.length > 500) throw new Error('Impor harus berisi 1–500 member.');
      const valid = members.map(memberInput);
      await transaction(pool, async (client) => { for (const input of valid) await client.query('INSERT INTO members (id,group_id,name,phone,status,process,updated_date,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [crypto.randomUUID(),input.groupId,input.name,input.phone,input.status,input.process,input.updatedDate,input.notes]); await client.query('INSERT INTO events (admin_id,text) VALUES ($1,$2)', [req.session.user.id, valid.length + ' member diimpor dari CSV.']); });
      res.json({ ok: true, count: valid.length });
    } catch (error) { sendError(res, error, 'Impor gagal.'); }
  });
  const frontendPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
  app.use(express.static(frontendPath, { index: 'index.html' }));
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
  return app;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) { const config = readConfig(), pool = createPool(config); createApp({ pool, config }).listen(config.port, config.host, () => console.log('Backend berjalan di http://' + config.host + ':' + config.port)); process.on('SIGTERM', async () => { await pool.end(); process.exit(0); }); }
