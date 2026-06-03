import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

await conn.execute(`
  CREATE TABLE IF NOT EXISTS pilots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    demo_request_id INT,
    org_name VARCHAR(300) NOT NULL,
    contact_name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(300) NOT NULL,
    contact_title VARCHAR(200),
    pilot_slug VARCHAR(100) NOT NULL UNIQUE,
    council_mode VARCHAR(100) NOT NULL DEFAULT 'infrastructure',
    max_evaluations INT NOT NULL DEFAULT 10,
    status ENUM('INVITED','ACTIVE','COMPLETED','CONVERTED','CHURNED') NOT NULL DEFAULT 'INVITED',
    access_token_hash VARCHAR(64),
    invited_at BIGINT NOT NULL,
    activated_at BIGINT,
    completed_at BIGINT,
    converted_at BIGINT,
    expires_at BIGINT,
    notes TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )
`);

await conn.execute(`
  CREATE TABLE IF NOT EXISTS pilot_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pilot_id INT NOT NULL,
    event_type ENUM('EVALUATION_RUN','REPORT_VIEWED','REPORT_SHARED','DEMO_VIEWED','PDF_EXPORTED','LOGIN') NOT NULL,
    deal_id VARCHAR(100),
    council_mode VARCHAR(100),
    metadata TEXT,
    created_at BIGINT NOT NULL
  )
`);

// Indexes (TiDB supports CREATE INDEX ... IF NOT EXISTS)
try { await conn.execute("CREATE INDEX pilot_status_idx ON pilots (status)"); } catch {}
try { await conn.execute("CREATE INDEX pilot_email_idx ON pilots (contact_email)"); } catch {}
try { await conn.execute("CREATE INDEX pilot_demo_idx ON pilots (demo_request_id)"); } catch {}
try { await conn.execute("CREATE INDEX pu_pilot_idx ON pilot_usage (pilot_id)"); } catch {}
try { await conn.execute("CREATE INDEX pu_event_idx ON pilot_usage (event_type)"); } catch {}
try { await conn.execute("CREATE INDEX pu_created_idx ON pilot_usage (created_at)"); } catch {}

console.log("✅ pilots and pilot_usage tables created");
await conn.end();
