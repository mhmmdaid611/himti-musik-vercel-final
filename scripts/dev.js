import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const children = [spawn(process.execPath, [resolve(root, 'backend/src/server.js')], { cwd: root, stdio: 'inherit' }), spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js')], { cwd: resolve(root, 'frontend'), stdio: 'inherit' })];
const stop = () => children.forEach((child) => child.kill('SIGTERM'));
process.on('SIGINT', stop); process.on('SIGTERM', stop);
children.forEach((child) => child.on('exit', (code) => { if (code && code !== 143) stop(); }));
