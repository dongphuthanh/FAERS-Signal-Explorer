// npm run labels:common — refresh each label's "most common adverse reactions" statement.
import { pool } from '../src/db.mjs';
import { refreshCommonStatements } from '../src/label-common.mjs';
const r = await refreshCommonStatements(pool);
console.log(`  ${r.found} of ${r.labels} labels state their most common adverse reactions in one sentence`);
await pool.end();
