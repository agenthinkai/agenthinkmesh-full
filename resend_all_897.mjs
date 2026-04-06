/**
 * resend_all_897.mjs
 * Resends the full outreach campaign to all 897 contacts across 11 markets.
 * Excludes: bejul@lsvp.com
 * Sends via Microsoft Graph API from farouq@agenthink.ai
 * CC: farouqsultan@gmail.com
 * Tracks delivery status in the outbound_emails database table.
 *
 * Usage: node resend_all_897.mjs
 */

import https from "https";
import { readFileSync, writeFileSync, appendFileSync } from "fs";
import mysql from "mysql2/promise";

// ── Config ────────────────────────────────────────────────────────────────────
const TENANT_ID     = process.env.MS_TENANT_ID     || "4e3c81c1-6864-4c56-af1b-30a2f16f84d4";
const CLIENT_ID     = process.env.MS_CLIENT_ID     || "1513f312-7259-4e67-b81d-5846d4d96c74";
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const FROM_EMAIL    = "farouq@agenthink.ai";
const CC_EMAIL      = "farouqsultan@gmail.com";
const EXCLUDE       = new Set(["bejul@lsvp.com"]);
const LOG_FILE      = "/home/ubuntu/resend_897_log.txt";
const DB_URL        = process.env.DATABASE_URL;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  appendFileSync(LOG_FILE, line);
}

// ── Load all contacts ─────────────────────────────────────────────────────────
function loadAllContacts() {
  const contacts = [];

  // Africa / UAE / Brazil (from JSON files)
  const africa = JSON.parse(readFileSync("/home/ubuntu/africa_contacts.json", "utf8"));
  const uae    = JSON.parse(readFileSync("/home/ubuntu/uae_contacts.json",    "utf8"));
  const brazil = JSON.parse(readFileSync("/home/ubuntu/brazil_contacts.json", "utf8"));
  const japan  = JSON.parse(readFileSync("/home/ubuntu/japan_contacts.json",  "utf8"));
  const korea  = JSON.parse(readFileSync("/home/ubuntu/korea_contacts.json",  "utf8"));

  africa.forEach(c => contacts.push({ ...c, market: "Africa" }));
  uae.forEach(c   => contacts.push({ ...c, market: "UAE" }));
  brazil.forEach(c => contacts.push({ ...c, market: "Brazil" }));
  japan.forEach(c  => contacts.push({ ...c, market: "Japan" }));
  korea.forEach(c  => contacts.push({ ...c, market: "Korea" }));

  // China (inline in script)
  const chinaSrc = readFileSync("/home/ubuntu/send_china58_emails.mjs", "utf8");
  extractInlineContacts(chinaSrc, "China").forEach(c => contacts.push(c));

  // Egypt
  const egyptSrc = readFileSync("/home/ubuntu/send_egypt50_emails.mjs", "utf8");
  extractInlineContacts(egyptSrc, "Egypt").forEach(c => contacts.push(c));

  // India
  const indiaSrc = readFileSync("/home/ubuntu/send_india100_emails.mjs", "utf8");
  extractInlineContacts(indiaSrc, "India").forEach(c => contacts.push(c));

  // Turkey
  const turkeySrc = readFileSync("/home/ubuntu/send_turkey50_emails.mjs", "utf8");
  extractInlineContacts(turkeySrc, "Turkey").forEach(c => contacts.push(c));

  // UK/Europe
  const ukSrc = readFileSync("/home/ubuntu/send_ukeurope97_emails.mjs", "utf8");
  extractInlineContacts(ukSrc, "UK/Europe").forEach(c => contacts.push(c));

  // USA
  const usaSrc = readFileSync("/home/ubuntu/send_usa100_emails.mjs", "utf8");
  extractInlineContacts(usaSrc, "USA").forEach(c => contacts.push(c));

  return contacts;
}

function extractInlineContacts(src, market) {
  const contacts = [];
  // Match objects like { name: "...", email: "...", company: "...", ... }
  const nameRe    = /name:\s*["']([^"']+)["']/g;
  const emailRe   = /email:\s*["']([^"']+)["']/g;
  const companyRe = /company:\s*["']([^"']+)["']/g;
  const langRe    = /language:\s*["']([^"']+)["']/g;

  const names    = [...src.matchAll(nameRe)].map(m => m[1]);
  const emails   = [...src.matchAll(emailRe)].map(m => m[1]);
  const companies = [...src.matchAll(companyRe)].map(m => m[1]);
  const langs    = [...src.matchAll(langRe)].map(m => m[1]);

  for (let i = 0; i < emails.length; i++) {
    contacts.push({
      name:     names[i]     || "Contact",
      email:    emails[i],
      company:  companies[i] || "",
      language: langs[i]     || "English",
      market,
    });
  }
  return contacts;
}

// ── Build email body ──────────────────────────────────────────────────────────
function buildEmail(contact) {
  const firstName = (contact.name || "").split(" ")[0] || "there";
  const lang = contact.language || "English";
  const market = contact.market || "";
  const company = contact.company || "your firm";

  // Determine angle based on market
  let angle = "$200M emerging market PE fund";
  if (market === "Africa")    angle = "$200M Africa PE fund";
  else if (market === "UAE")  angle = "$200M UAE PE fund";
  else if (market === "Brazil") angle = "$200M Brazil PE fund";
  else if (market === "India")  angle = "$200M India PE fund";
  else if (market === "China")  angle = "$200M China PE fund";
  else if (market === "Japan")  angle = "$200M Japan PE fund";
  else if (market === "Korea")  angle = "$200M Korea PE fund";
  else if (market === "UK/Europe") angle = "$200M European PE fund";
  else if (market === "USA")    angle = "$200M US PE fund";
  else if (market === "Egypt")  angle = "$200M Egypt PE fund";
  else if (market === "Turkey") angle = "$200M Turkey PE fund";

  if (lang === "Portuguese") {
    return {
      subject: `AgenThink — Memo de IC de 35 páginas em 4 minutos | ${company}`,
      body: `Prezado(a) ${firstName},\n\nEspero que esteja bem.\n\nA AgenThink recentemente analisou um ${angle} através da nossa plataforma — 10 agentes de IA especializados (CFO, jurídico, risco, especialistas setoriais) operando em paralelo — e produziu um memo de IC de 35 páginas em 4 minutos. Tese de investimento, testes de estresse de TIR, rotas de saída, benchmarks setoriais e um plano de ação de 30 dias.\n\nDado o fluxo de negócios e o ritmo de investimento da ${company}, pensei que valeria uma conversa de 15 minutos. Ficamos felizes em realizar a primeira análise em um negócio real sem custo.\n\nAtenciosamente,\nFarouq Sultan\nCEO & Founder, AgenThink\n+965 99608209`,
    };
  } else if (lang === "Arabic") {
    return {
      subject: `AgenThink — مذكرة IC من 35 صفحة في 4 دقائق | ${company}`,
      body: `عزيزي ${firstName}،\n\nأتمنى أن تكون بخير.\n\nقامت AgenThink مؤخراً بفحص ${angle} من خلال منصتنا — 10 وكلاء ذكاء اصطناعي متخصصين (CFO، قانوني، مخاطر، خبراء قطاعيين) يعملون بالتوازي — وأنتجوا مذكرة IC جاهزة من 35 صفحة في 4 دقائق. تشمل: الأطروحة الاستثمارية، اختبارات ضغط IRR، مسارات الخروج، المعايير القطاعية، وخطة عمل 30 يوماً.\n\nبالنظر إلى تدفق الصفقات ووتيرة الاستثمار في ${company}، أعتقد أن محادثة لمدة 15 دقيقة ستكون ذات قيمة. يسعدنا إجراء التحليل الأول على صفقة حقيقية مجاناً.\n\nمع التقدير،\nFarouq Sultan\nCEO & Founder, AgenThink\n+965 99608209`,
    };
  } else if (lang === "Mandarin" || lang === "Chinese") {
    return {
      subject: `AgenThink — 4分钟生成35页IC备忘录 | ${company}`,
      body: `尊敬的${firstName}，\n\n希望您一切安好。\n\nAgenThink最近通过我们的平台对一个${angle}进行了筛选——10位专业AI代理（CFO、法律、风险、行业专家）并行运作——在4分钟内生成了一份35页的IC备忘录。包括：投资论点、IRR压力测试、退出路径、行业基准和30天行动计划。\n\n鉴于${company}的交易流量和投资节奏，我认为进行15分钟的交流会很有价值。我们很乐意对真实交易进行免费的首次分析。\n\n此致，\nFarouq Sultan\nCEO & Founder, AgenThink\n+965 99608209`,
    };
  } else if (lang === "Japanese") {
    return {
      subject: `AgenThink — 4分でIC資料35ページ | ${company}`,
      body: `${firstName}様、\n\nお世話になっております。\n\nAgenThinkは最近、当社のプラットフォームを通じて${angle}のスクリーニングを行いました。10名の専門AIエージェント（CFO、法務、リスク、セクター専門家）が並行して稼働し、4分間で35ページのIC資料を作成しました。投資論文、IRRストレステスト、出口経路、セクターベンチマーク、30日間アクションプランが含まれています。\n\n${company}のディールフローと投資ペースを考えると、15分間の会話が有益だと思います。実際の案件での初回分析を無料で行います。\n\n敬具、\nFarouq Sultan\nCEO & Founder, AgenThink\n+965 99608209`,
    };
  } else if (lang === "Korean") {
    return {
      subject: `AgenThink — 4분 만에 35페이지 IC 메모 | ${company}`,
      body: `${firstName}님,\n\n안녕하세요.\n\nAgenThink는 최근 당사 플랫폼을 통해 ${angle}을 스크리닝했습니다. 10명의 전문 AI 에이전트(CFO, 법무, 리스크, 섹터 전문가)가 병렬로 운영되어 4분 만에 35페이지 IC 메모를 생성했습니다. 투자 논제, IRR 스트레스 테스트, 출구 경로, 섹터 벤치마크 및 30일 실행 계획이 포함됩니다.\n\n${company}의 딜 플로우와 투자 속도를 고려할 때, 15분 대화가 가치 있을 것이라 생각합니다. 실제 딜에 대한 첫 번째 분석을 무료로 진행해 드리겠습니다.\n\n감사합니다,\nFarouq Sultan\nCEO & Founder, AgenThink\n+965 99608209`,
    };
  } else if (lang === "Turkish") {
    return {
      subject: `AgenThink — 4 dakikada 35 sayfalık IC notu | ${company}`,
      body: `Sayın ${firstName},\n\nUmarım iyisinizdir.\n\nAgenThink, yakın zamanda platformumuz aracılığıyla ${angle} için bir tarama gerçekleştirdi — 10 uzman AI ajan (CFO, hukuk, risk, sektör uzmanları) paralel olarak çalışarak 4 dakikada 35 sayfalık IC notu üretti. Yatırım tezi, IRR stres testleri, çıkış yolları, sektör kıyaslamaları ve 30 günlük eylem planı içermektedir.\n\n${company}'nin işlem akışı ve yatırım temposunu göz önünde bulundurarak, 15 dakikalık bir görüşmenin değerli olacağını düşündüm. İlk analizi gerçek bir işlem üzerinde ücretsiz yapmaktan memnuniyet duyarız.\n\nSaygılarımla,\nFarouq Sultan\nCEO & Founder, AgenThink\n+965 99608209`,
    };
  } else {
    return {
      subject: `AgenThink — 35-page IC memo in 4 minutes | ${company}`,
      body: `Dear ${firstName},\n\nI hope this finds you well.\n\nAgenThink recently screened a ${angle} through our platform — 10 specialist AI agents (CFO, legal, risk, sector experts) running in parallel — and returned a 35-page IC-ready memo in 4 minutes. Investment thesis, IRR stress tests, exit pathways, sector benchmarks, and a 30-day action plan.\n\nGiven ${company}'s deal flow and investment pace, I thought this might be worth a 15-minute conversation. We'd be happy to run the first analysis on a live deal at no charge.\n\nBest,\nFarouq Sultan\nCEO & Founder, AgenThink\n+965 99608209`,
    };
  }
}

// ── MS Graph token ────────────────────────────────────────────────────────────
async function getToken() {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
    }).toString();

    const req = https.request({
      hostname: "login.microsoftonline.com",
      path: `/${TENANT_ID}/oauth2/v2.0/token`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        const json = JSON.parse(data);
        if (json.access_token) resolve(json.access_token);
        else reject(new Error(JSON.stringify(json)));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Send one email via MS Graph ───────────────────────────────────────────────
async function sendViaGraph(token, contact, emailContent) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      message: {
        subject: emailContent.subject,
        body: { contentType: "Text", content: emailContent.body },
        toRecipients: [{ emailAddress: { address: contact.email, name: contact.name || "" } }],
        ccRecipients: [{ emailAddress: { address: CC_EMAIL } }],
      },
      saveToSentItems: true,
    });

    const req = https.request({
      hostname: "graph.microsoft.com",
      path: `/v1.0/users/${FROM_EMAIL}/sendMail`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode === 202) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `HTTP ${res.statusCode}: ${data.substring(0, 200)}` });
        }
      });
    });
    req.on("error", (err) => resolve({ success: false, error: err.message }));
    req.write(payload);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log("=== AgenThink Resend Campaign — All 897 Contacts ===");

  if (!CLIENT_SECRET) {
    log("[Error] MS_CLIENT_SECRET not set in environment.");
    process.exit(1);
  }

  // Load all contacts
  const allContacts = loadAllContacts();
  const contacts = allContacts.filter(c => c.email && !EXCLUDE.has(c.email.toLowerCase()));
  log(`[Load] Total contacts loaded: ${allContacts.length} | After exclusions: ${contacts.length}`);

  // Deduplicate by email
  const seen = new Set();
  const unique = contacts.filter(c => {
    const key = c.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  log(`[Dedup] Unique recipients: ${unique.length}`);

  // Connect to DB
  let db = null;
  if (DB_URL) {
    db = await mysql.createConnection(DB_URL);
    log("[DB] Connected to database.");
  } else {
    log("[DB] No DATABASE_URL — delivery status will not be persisted.");
  }

  // Get MS Graph token
  log("[Auth] Obtaining Microsoft Graph access token...");
  let token;
  try {
    token = await getToken();
    log("[Auth] Token obtained.");
  } catch (err) {
    log(`[Auth] FAILED: ${err.message}`);
    if (db) await db.end();
    process.exit(1);
  }

  // Counters
  let sent = 0, delivered = 0, failed = 0;
  const failedList = [];

  // Market breakdown
  const marketCounts = {};

  for (let i = 0; i < unique.length; i++) {
    const contact = unique[i];
    const emailContent = buildEmail(contact);
    const progress = `[${i + 1}/${unique.length}]`;

    try {
      const result = await sendViaGraph(token, contact, emailContent);

      if (result.success) {
        sent++;
        delivered++;
        marketCounts[contact.market] = (marketCounts[contact.market] || 0) + 1;
        log(`${progress} ✅ SENT → ${contact.name} <${contact.email}> (${contact.company}) [${contact.market}]`);

        // Upsert into outbound_emails
        if (db) {
          await db.query(
            `INSERT INTO outbound_emails 
              (recipientName, recipientEmail, recipientFirm, recipientRole, market, subject, language, sentAt, resentAt, deliveryStatus)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 'sent')
             ON DUPLICATE KEY UPDATE 
               resentAt = NOW(), deliveryStatus = 'sent', resendMsMessageId = 'resent-apr-2026'`,
            [
              contact.name || "",
              contact.email,
              contact.company || "",
              contact.role || "",
              contact.market || "",
              emailContent.subject,
              contact.language || "English",
            ]
          );
        }
      } else {
        failed++;
        failedList.push({ email: contact.email, name: contact.name, error: result.error });
        log(`${progress} ❌ FAILED → ${contact.email} | ${result.error}`);

        if (db) {
          await db.query(
            `INSERT INTO outbound_emails 
              (recipientName, recipientEmail, recipientFirm, market, subject, language, sentAt, resentAt, deliveryStatus)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), 'failed')
             ON DUPLICATE KEY UPDATE 
               resentAt = NOW(), deliveryStatus = 'failed'`,
            [contact.name || "", contact.email, contact.company || "", contact.market || "", emailContent.subject, contact.language || "English"]
          );
        }
      }
    } catch (err) {
      failed++;
      failedList.push({ email: contact.email, name: contact.name, error: err.message });
      log(`${progress} ❌ EXCEPTION → ${contact.email} | ${err.message}`);
    }

    // Rate limit: ~4 emails/sec
    if (i < unique.length - 1) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  // ── Final Summary ─────────────────────────────────────────────────────────
  const summary = {
    runAt: new Date().toISOString(),
    totalQueried: unique.length,
    excluded: [...EXCLUDE],
    totalSent: sent,
    totalDelivered: delivered,
    totalFailed: failed,
    marketBreakdown: marketCounts,
    failedEmails: failedList,
  };

  log("\n" + "=".repeat(65));
  log("  RESEND CAMPAIGN — FINAL SUMMARY");
  log("=".repeat(65));
  log(`  Run at:          ${summary.runAt}`);
  log(`  Total queried:   ${unique.length}`);
  log(`  Excluded:        ${[...EXCLUDE].join(", ")}`);
  log(`  Total sent:      ${sent}`);
  log(`  Delivered:       ${delivered}`);
  log(`  Failed:          ${failed}`);
  log("  Market breakdown:");
  Object.entries(marketCounts).sort((a,b) => b[1]-a[1]).forEach(([m, c]) => log(`    ${m}: ${c}`));
  log("=".repeat(65));

  if (failedList.length > 0) {
    log("\n  FAILED EMAILS:");
    failedList.forEach(f => log(`  - ${f.email} (${f.name}): ${f.error?.substring(0, 100)}`));
  }

  writeFileSync("/home/ubuntu/resend_897_summary.json", JSON.stringify(summary, null, 2));
  log("\n  Summary saved to: /home/ubuntu/resend_897_summary.json");

  if (db) await db.end();
}

main().catch(err => {
  console.error("[Fatal]", err);
  process.exit(1);
});
