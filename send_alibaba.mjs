import "dotenv/config";

const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const TENANT_ID = process.env.MS_TENANT_ID;
const SENDER_EMAIL = "farouq@agenthink.ai";

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
  });
  const res = await fetch(url, { method: "POST", body });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get token: " + JSON.stringify(data));
  return data.access_token;
}

async function sendEmail(token, to, name, subject, htmlBody) {
  const url = `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`;
  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: htmlBody },
      toRecipients: [{ emailAddress: { address: to, name } }],
      ccRecipients: [{ emailAddress: { address: "farouqsultan@gmail.com", name: "Farouq Sultan" } }],
    },
    saveToSentItems: true,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Send failed for ${to}: ${err}`); }
}

// Email format: first.last@alibaba-inc.com (46% confirmed — LeadIQ) / first.last@alibabagroup.com for senior execs
const contacts = [
  // Group C-Suite & Board
  { name: "Joseph Tsai",         email: "joseph.tsai@alibabagroup.com",       title: "Executive Chairman, Alibaba Group" },
  { name: "Eddie Wu",            email: "eddie.wu@alibabagroup.com",           title: "CEO & Director, Alibaba Group" },
  { name: "J. Michael Evans",    email: "michael.evans@alibabagroup.com",      title: "President & Director, Alibaba Group" },
  { name: "Maggie Wu",           email: "maggie.wu@alibabagroup.com",          title: "Director, Alibaba Group; Former CFO" },
  { name: "Toby Xu",             email: "toby.xu@alibabagroup.com",            title: "CFO, Alibaba Group" },
  { name: "Jiang Fang",          email: "jiang.fang@alibabagroup.com",         title: "Chief People Officer, Alibaba Group" },
  { name: "Trudy Dai",           email: "trudy.dai@alibabagroup.com",          title: "CEO, Taobao & Tmall Group" },
  { name: "Jiang Fan",           email: "jiang.fan@alibabagroup.com",          title: "CEO, International Digital Commerce Group" },
  { name: "Wu Yongming",         email: "wu.yongming@alibabagroup.com",        title: "CEO, Alibaba Cloud Intelligence Group" },
  { name: "Wan Lin",             email: "wan.lin@alibabagroup.com",            title: "CEO, Cainiao Smart Logistics Network" },
  { name: "Yu Yongfu",           email: "yu.yongfu@alibabagroup.com",          title: "CEO, Local Services Group" },
  { name: "Fan Luyuan",          email: "fan.luyuan@alibabagroup.com",         title: "CEO, Digital Media & Entertainment Group" },
  // Alibaba Cloud & AI
  { name: "Alibaba Cloud CEO",   email: "cloud.ceo@alibaba-inc.com",           title: "CEO, Alibaba Cloud Intelligence" },
  { name: "Zhou Jingren",        email: "zhou.jingren@alibaba-inc.com",        title: "CTO, Alibaba Cloud; Chief Scientist, AI" },
  { name: "Jian Wang",           email: "jian.wang@alibaba-inc.com",           title: "Co-Founder; Chairman, Alibaba Cloud" },
  { name: "Xuan Fei",            email: "xuan.fei@alibaba-inc.com",            title: "VP, Alibaba Cloud International" },
  { name: "Selina Yuan",         email: "selina.yuan@alibaba-inc.com",         title: "President, Alibaba Cloud International" },
  { name: "Leon Chen",           email: "leon.chen@alibaba-inc.com",           title: "VP, Alibaba Cloud Enterprise" },
  { name: "Raymond Ma",          email: "raymond.ma@alibaba-inc.com",          title: "VP, Alibaba Cloud APAC" },
  { name: "Derek Wang",          email: "derek.wang@alibaba-inc.com",          title: "VP, Alibaba Cloud Middle East & Africa" },
  // Alibaba International Commerce
  { name: "Kuo Zhang",           email: "kuo.zhang@alibaba-inc.com",           title: "President, Alibaba.com International" },
  { name: "Zhijian Chen",        email: "zhijian.chen@alibaba-inc.com",        title: "VP, AliExpress" },
  { name: "Peng Lei",            email: "peng.lei@alibaba-inc.com",            title: "Co-Founder; Former CEO, Ant Group" },
  // Ant Group / Alipay
  { name: "Eric Jing",           email: "eric.jing@antgroup.com",              title: "Executive Chairman, Ant Group" },
  { name: "Simon Hu",            email: "simon.hu@antgroup.com",               title: "CEO, Ant Group" },
  { name: "Leiming Chen",        email: "leiming.chen@antgroup.com",           title: "CTO, Ant Group" },
  // Alibaba.com B2B
  { name: "Kuo Zhang B2B",       email: "kuo.zhang2@alibaba-inc.com",          title: "President, Alibaba.com" },
  { name: "John Caplan",         email: "john.caplan@alibaba-inc.com",         title: "President, North America & Europe, Alibaba.com" },
  { name: "Andrew Zheng",        email: "andrew.zheng@alibaba-inc.com",        title: "VP, Alibaba.com Global Operations" },
  { name: "Kathy Zheng",         email: "kathy.zheng@alibaba-inc.com",         title: "VP, Alibaba.com Marketing" },
  // Lazada
  { name: "Dong Zheng",          email: "dong.zheng@lazada.com",               title: "CEO, Lazada Group" },
  { name: "James Chang",         email: "james.chang@lazada.com",              title: "COO, Lazada Group" },
  // Trendyol
  { name: "Caglayan Celik",      email: "caglayan.celik@trendyol.com",         title: "CEO, Trendyol Group" },
  // Cainiao
  { name: "Pengcheng Wan",       email: "pengcheng.wan@cainiao.com",           title: "CEO, Cainiao Smart Logistics" },
  { name: "Jia Luo",             email: "jia.luo@cainiao.com",                 title: "COO, Cainiao Smart Logistics" },
  // DingTalk
  { name: "Ye Jun",              email: "ye.jun@dingtalk.com",                 title: "President, DingTalk" },
  // Alibaba Health
  { name: "Zhu Shunyan",         email: "zhu.shunyan@alihealth.com",           title: "CEO, Alibaba Health" },
  // Fliggy / Travel
  { name: "Zhuang Zhuo",         email: "zhuang.zhuo@fliggy.com",              title: "President, Fliggy" },
  // Youku
  { name: "Yang Wei",            email: "yang.wei@youku.com",                  title: "President, Youku" },
  // DAMO Academy
  { name: "Jeff Zhang",          email: "jeff.zhang@alibaba-inc.com",          title: "President, Alibaba DAMO Academy; Former CTO" },
  // Corporate Development & Strategy
  { name: "Xiaolong Meng",       email: "xiaolong.meng@alibaba-inc.com",       title: "VP, Corporate Development" },
  { name: "Robbie Luo",          email: "robbie.luo@alibaba-inc.com",          title: "VP, Corporate Strategy" },
  // Legal & Compliance
  { name: "Timothy Steinert",    email: "timothy.steinert@alibaba-inc.com",    title: "General Counsel, Alibaba Group" },
  // Investor Relations
  { name: "Rob Lin",             email: "rob.lin@alibaba-inc.com",             title: "Head, Investor Relations" },
  // Marketing & Communications
  { name: "Brion Tingler",       email: "brion.tingler@alibaba-inc.com",       title: "Head, International Corporate Affairs" },
  // Global Partnerships
  { name: "Brian Wong",          email: "brian.wong@alibaba-inc.com",          title: "VP, Global Initiatives & Partnerships" },
  // Sustainability
  { name: "Wan Jing",            email: "wan.jing@alibaba-inc.com",            title: "VP, Sustainability" },
  // Board Independent Directors
  { name: "Jerry Yang",          email: "jerry.yang@alibabagroup.com",         title: "Independent Director, Alibaba Group" },
  { name: "Kabir Misra",         email: "kabir.misra@alibabagroup.com",        title: "Independent Director, Alibaba Group" },
  { name: "Wan Ling Martello",   email: "wanling.martello@alibabagroup.com",   title: "Independent Director, Alibaba Group" },
];

const SUBJECT = "35-page IC memo in 4 minutes — AI decision intelligence for global commerce & cloud";

function buildEmail(firstName) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.7; color: #1a1a1a; max-width: 620px; margin: 0 auto; padding: 32px 24px; }
  p { margin: 0 0 16px 0; } ul { margin: 12px 0 20px 0; padding-left: 20px; } li { margin-bottom: 8px; }
  .signature { margin-top: 32px; border-top: 1px solid #e0e0e0; padding-top: 20px; font-size: 13px; color: #555; }
</style></head><body>
<p>Dear ${firstName},</p>
<p>I am writing to share <strong>AgenThinkMesh</strong> — an AI-native decision intelligence platform that produces a <strong>35-page institutional-grade analysis memo in under 4 minutes</strong>, powered by a council of 10 independent AI agents running in parallel.</p>
<p>The system is a production-grade implementation of multi-agent AI for complex, high-stakes business decisions: each agent operates as a specialist with independent scoring frameworks and veto logic, covering strategic analysis, competitive positioning, risk identification, financial modelling, and market assessment. A weighted consensus algorithm synthesises their outputs into a structured recommendation — with every agent vote, rationale, and confidence score logged and fully auditable.</p>
<p>A few things that may be relevant to Alibaba:</p>
<ul>
  <li><strong>Commerce intelligence at scale</strong> — across Alibaba's global commerce platforms (Taobao, Tmall, AliExpress, Lazada, Trendyol), the multi-agent council architecture can synthesise market intelligence, competitive positioning, and strategic context for new market entry, category expansion, or merchant partnership decisions in minutes</li>
  <li><strong>Alibaba Cloud enterprise AI</strong> — AgenThinkMesh represents a production-grade multi-agent AI application built on top of LLM infrastructure; directly relevant to Alibaba Cloud's enterprise AI product roadmap and Qwen model ecosystem — a potential showcase application or partnership opportunity</li>
  <li><strong>Strategic decision acceleration</strong> — the platform compresses weeks of research and synthesis into minutes; applicable to Alibaba's corporate development, M&A evaluation, and international expansion strategy processes</li>
  <li><strong>Cainiao & logistics intelligence</strong> — the system can synthesise supply chain data, route intelligence, and risk parameters into structured decision memos; a force multiplier for Cainiao's global logistics operations</li>
  <li><strong>Auditable AI for enterprise governance</strong> — every agent vote, rationale, and confidence score is logged; the system produces a full audit trail for enterprise decision governance — aligned with Alibaba's responsible AI commitments</li>
</ul>
<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Alibaba's commerce intelligence, cloud AI product roadmap, or enterprise decision infrastructure.</p>
<p>Would any time this week or next work for a brief call?</p>
<p>Warm regards,</p>
<div class="signature">
  <strong>Farouq Sultan</strong><br>Founder & CEO, AgenThinkMesh<br>
  <a href="mailto:farouq@agenthink.ai">farouq@agenthink.ai</a><br>+965 99608209<br>
  <a href="https://agenthink-7enctkan.manus.space">agenthink-7enctkan.manus.space</a>
</div>
</body></html>`;
}

async function main() {
  console.log("Authenticating with Microsoft Graph...");
  const token = await getAccessToken();
  console.log("✅ Token obtained\n");
  console.log("📧 Sending Alibaba review copy...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Alibaba] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO ALIBABA GROUP — ${contacts.length} contacts`);
  console.log("─".repeat(60));

  let sent = 0, failed = 0;
  for (let i = 0; i < contacts.length; i++) {
    const { name, email } = contacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, SUBJECT, buildEmail(firstName));
      console.log(`✅ [${i + 1}/${contacts.length}] ${name} <${email}>`);
      sent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${contacts.length}] ${name} <${email}>: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`\n${"═".repeat(60)}`);
  console.log(`ALIBABA: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
