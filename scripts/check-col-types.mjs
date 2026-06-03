import mysql from 'mysql2/promise';

const tables = [
  'admesh_runs','batch_jobs','cfa_sessions','client_encryption_keys','cmk_audit_log',
  'contacts','deal_screener_payments','deal_screening_rate_limit','deal_screenings','deal_signals',
  'decision_upgrade_runs','email_events','forecasts','insurance_runs','intel_analyses','ips_configs',
  'llm_usage','login_events','mesh_tasks','mvno_agent_runs','pitch_triages','portfolio_runs',
  'scenario_sim_runs','shared_reports','subscriptions','takaful_alerts','task_history','token_usage',
  'user_profiles','user_signal_prefs','vault_documents','vendor_evaluations','workflow_runs','users'
];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

for (const tbl of tables) {
  const [cols] = await conn.execute(`SHOW COLUMNS FROM ${tbl} WHERE Field IN ('userId','user_id','createdByAdminId')`);
  for (const col of cols) {
    const isInt = col.Type.includes('int');
    console.log(`${isInt ? 'INT  ' : 'NON-INT'}: ${tbl}.${col.Field} (${col.Type})`);
  }
}
console.log('done');
await conn.end();
