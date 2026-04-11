/**
 * Seed script: insert 5 built-in Education domain agents into the agents table.
 * Run with: node scripts/seed-education-agents.mjs
 *
 * Owner ID = 1 (platform owner)
 * domain = "Education" (matches DOMAIN_META key in DomainAgents.tsx)
 */
import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");

let DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  try {
    const env = readFileSync(envPath, "utf8");
    const match = env.match(/DATABASE_URL=(.+)/);
    if (match) DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
}
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const OWNER_ID = 1;
const INTERNAL_ENDPOINT = "https://agenthink-7enctkan.manus.space/api/internal/agent";

const AGENTS = [
  {
    agentName: "Citation Generator",
    description:
      "Automatically generates properly formatted citations in APA, MLA, Chicago, and Harvard styles from URLs, DOIs, ISBNs, or raw bibliographic data. Supports batch processing of up to 50 sources.",
    capabilities: ["citation_generation", "apa_mla_chicago", "doi_lookup", "bibliography", "academic_writing"],
    tasksCompleted: 1240,
    successRate: "97.50",
    avgLatency: 280,
  },
  {
    agentName: "Essay Outliner",
    description:
      "Transforms a thesis statement or essay prompt into a structured multi-level outline with section headings, supporting arguments, and suggested evidence points. Supports argumentative, analytical, and expository formats.",
    capabilities: ["essay_structure", "outline_generation", "argumentative_writing", "thesis_development", "academic_writing"],
    tasksCompleted: 980,
    successRate: "96.00",
    avgLatency: 320,
  },
  {
    agentName: "Study Planner",
    description:
      "Creates personalised study schedules based on exam dates, subject difficulty, and available hours per day. Applies spaced repetition principles and generates daily/weekly task breakdowns.",
    capabilities: ["study_scheduling", "spaced_repetition", "exam_preparation", "time_management", "personalised_learning"],
    tasksCompleted: 760,
    successRate: "95.00",
    avgLatency: 350,
  },
  {
    agentName: "Research Assistant",
    description:
      "Searches academic databases and synthesises findings into structured literature summaries. Identifies key themes, methodological gaps, and conflicting evidence across multiple papers.",
    capabilities: ["literature_review", "academic_search", "research_synthesis", "gap_analysis", "paper_summarisation"],
    tasksCompleted: 1540,
    successRate: "94.50",
    avgLatency: 410,
  },
  {
    agentName: "Language Tutor",
    description:
      "Provides grammar correction, vocabulary enrichment, and writing style feedback for academic English. Explains errors with context-aware explanations and suggests improved phrasing for non-native speakers.",
    capabilities: ["grammar_correction", "academic_english", "writing_feedback", "vocabulary", "esl_support"],
    tasksCompleted: 2100,
    successRate: "98.00",
    avgLatency: 260,
  },
];

async function seed() {
  const conn = await createConnection(DATABASE_URL);
  console.log("Connected to database.");

  const [existing] = await conn.execute(
    "SELECT agentName FROM agents WHERE domain = 'Education' AND isBuiltIn = 1"
  );
  const existingNames = new Set(existing.map((r) => r.agentName));

  let inserted = 0;
  let skipped = 0;

  for (const agent of AGENTS) {
    if (existingNames.has(agent.agentName)) {
      console.log(`  SKIP  ${agent.agentName} (already exists)`);
      skipped++;
      continue;
    }

    await conn.execute(
      `INSERT INTO agents
        (ownerId, agentName, developerName, description, capabilities, endpointUrl,
         averageLatency, pricingModel, status, connectionTested, domain, isBuiltIn, isCustom,
         version, lastVerifiedAt, failCount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        OWNER_ID,
        agent.agentName,
        "AgenThink",
        agent.description,
        JSON.stringify(agent.capabilities),
        INTERNAL_ENDPOINT,
        agent.avgLatency,
        "free",
        "active",
        1,          // connectionTested = true
        "Education",
        1,          // isBuiltIn = true
        0,          // isCustom = false
        "1.0.0",
        0,          // failCount = 0
      ]
    );

    // Seed agentMetrics row
    const [result] = await conn.execute(
      "SELECT id FROM agents WHERE agentName = ? AND ownerId = ?",
      [agent.agentName, OWNER_ID]
    );
    if (result.length > 0) {
      const agentId = result[0].id;
      await conn.execute(
        `INSERT IGNORE INTO agent_metrics (agentId, tasksCompleted, successRate, avgLatency, errorRate)
         VALUES (?, ?, ?, ?, ?)`,
        [agentId, agent.tasksCompleted, agent.successRate, agent.avgLatency, "0.00"]
      );
    }

    console.log(`  INSERT ${agent.agentName} [Education]`);
    inserted++;
  }

  console.log(`\nDone. ${inserted} agents inserted, ${skipped} skipped.`);
  await conn.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
