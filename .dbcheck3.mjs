import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(`select id, source, "createdAt", substring(content, 1, 100) as preview from "Insight" where "communityId" = '5ad4db20-6a47-41a9-a369-e339a6d05cc0' order by "createdAt" desc limit 10`);
console.log('rows:', r.rows.length);
const now = Date.now();
for (const row of r.rows) {
  const t = row.createdAt.toISOString();
  const ageSec = Math.round((now - row.createdAt.getTime()) / 1000);
  const src = row.source;
  const p = row.preview.replace(/\n/g, ' ');
  console.log('  ' + t + '  (' + ageSec + 's ago)  source=' + src + '  ' + JSON.stringify(p));
}
await pool.end();
