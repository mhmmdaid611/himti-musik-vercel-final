import { createApp } from '../backend/src/server.js';
import { createPool } from '../backend/src/db.js';
import { readConfig } from '../backend/src/config.js';

const config = readConfig();
const pool = createPool(config);

export default createApp({ pool, config });
