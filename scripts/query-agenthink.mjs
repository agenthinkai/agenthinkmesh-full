import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [orgs] = await conn.execute("SELECT id, name, slug, status FROM organizations WHERE slug = 'agenthinkmesh' OR name LIKE '%AgenThink%' LIMIT 5");
console.log('ORGS:', JSON.stringify(orgs, null, 2));

const [bps] = await conn.execute("SELECT id, blueprint_id, name, slug, status FROM twin_blueprints WHERE blueprint_id = 'bp-agenthink' LIMIT 3");
console.log('BLUEPRINTS:', JSON.stringify(bps, null, 2));

const [twins] = await conn.execute("SELECT id, orgId, blueprintId, instanceSlug, displayName, status FROM twin_instances WHERE orgId = 1 ORDER BY id LIMIT 12");
console.log('TWIN INSTANCES:', JSON.stringify(twins, null, 2));

const [users] = await conn.execute("SELECT id, name, email, role, orgId FROM users WHERE orgId = '1' LIMIT 5");
console.log('USERS IN ORG:', JSON.stringify(users, null, 2));

await conn.end();
