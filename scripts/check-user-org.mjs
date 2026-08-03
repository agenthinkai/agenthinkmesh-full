import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const db = await createConnection(process.env.DATABASE_URL);
const [users] = await db.query("SELECT id, name, orgId, role FROM users LIMIT 5");
console.log("users:", JSON.stringify(users, null, 2));
const [orgs] = await db.query("SELECT id, name, slug, status FROM organizations LIMIT 5");
console.log("orgs:", JSON.stringify(orgs, null, 2));
const [twins] = await db.query("SELECT id, orgId, blueprintId, instanceSlug, displayName, status FROM twin_instances LIMIT 5");
console.log("twin_instances:", JSON.stringify(twins, null, 2));
await db.end();
