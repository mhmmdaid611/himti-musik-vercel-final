// Vercel Node.js server entrypoint.
// The same Express app remains usable locally through npm run dev/start.
import { createApp } from './backend/src/server.js';
import { createPool } from './backend/src/db.js';
import { readConfig } from './backend/src/config.js';

const config = readConfig();
const pool = createPool(config);
const app = createApp({ pool, config });

const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
process.on('SIGTERM', async () => { await pool.end(); server.close(() => process.exit(0)); });
