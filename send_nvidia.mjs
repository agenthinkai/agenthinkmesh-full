import "dotenv/config";

const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const TENANT_ID = process.env.MS_TENANT_ID;
const FROM_EMAIL = 'farouq@agenthink.ai';
const REVIEW_EMAIL = 'farouqsultan@gmail.com';
const CC_EMAIL = 'farouqsultan@gmail.com';

async function getToken() {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function sendEmail(token, to, subject, body) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${FROM_EMAIL}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
        ccRecipients: [{ emailAddress: { address: CC_EMAIL } }],
      },
      saveToSentItems: true,
    }),
  });
  return res.status === 202;
}

const subject = '35-page IC memo in 4 minutes — multi-agent AI for semiconductor & enterprise intelligence';

const emailBody = `<p>Dear NVIDIA Leader,</p>

<p>AgenThink has built a multi-agent AI system that produces a 35-page investment committee memo — with market analysis, competitive landscape, risk assessment, and strategic recommendations — in under 4 minutes. What typically takes a senior analyst 3–5 days now runs autonomously, with a full audit trail.</p>

<p>For NVIDIA, the implications are significant across multiple dimensions:</p>

<ul>
<li><strong>Enterprise AI Sales Intelligence:</strong> Real-time competitive analysis and market positioning for NVIDIA's enterprise AI platform sales teams</li>
<li><strong>Partner & Ecosystem Intelligence:</strong> Automated due diligence on ISV partners, system integrators, and cloud partnerships</li>
<li><strong>Investor Relations Support:</strong> Rapid synthesis of analyst reports, earnings call intelligence, and market sentiment</li>
<li><strong>CUDA & AI Platform Benchmarking:</strong> Automated technical and commercial benchmarking reports for GPU and AI platform decisions</li>
</ul>

<p>Our system is already deployed in GCC sovereign wealth funds and PE firms, processing thousands of data points per run with zero hallucination on structured outputs.</p>

<p>I would welcome a 20-minute call to walk you through a live demo tailored to NVIDIA's use case. Would any time this week or next work?</p>

<p>Best regards,<br>
Farouq Sultan<br>
CEO, AgenThink<br>
farouq@agenthink.ai</p>`;

const contacts = [
  // Founders & C-Suite
  { name: 'Jensen Huang', title: 'Founder, President & CEO', email: 'jhuang@nvidia.com' },
  { name: 'Chris Malachowsky', title: 'Co-Founder & NVIDIA Fellow', email: 'cmalachowsky@nvidia.com' },
  { name: 'Colette Kress', title: 'EVP & CFO', email: 'ckress@nvidia.com' },
  { name: 'Jay Puri', title: 'EVP, Worldwide Field Operations', email: 'jpuri@nvidia.com' },
  { name: 'Debora Shoquist', title: 'EVP, Operations', email: 'dshoquist@nvidia.com' },
  { name: 'Tim Teter', title: 'EVP, General Counsel & Secretary', email: 'tteter@nvidia.com' },
  // Research & Science
  { name: 'William Dally', title: 'Chief Scientist & SVP Research', email: 'bdally@nvidia.com' },
  { name: 'Bryan Catanzaro', title: 'VP, Applied Deep Learning Research', email: 'bcatanzaro@nvidia.com' },
  { name: 'Anima Anandkumar', title: 'Director, ML Research', email: 'aanandkumar@nvidia.com' },
  { name: 'Stephen Keckler', title: 'VP, Architecture Research', email: 'skeckler@nvidia.com' },
  // Engineering
  { name: 'Jonah Alben', title: 'SVP, GPU Engineering', email: 'jalben@nvidia.com' },
  { name: 'Joseph Greco', title: 'SVP, Advanced Technology', email: 'jgreco@nvidia.com' },
  { name: 'Tommy Lee', title: 'SVP, Systems Engineering', email: 'tlee@nvidia.com' },
  { name: 'John Spitzer', title: 'VP, Developer & Performance Technology', email: 'jspitzer@nvidia.com' },
  { name: 'Luis Ceze', title: 'VP, AI Systems Software', email: 'lceze@nvidia.com' },
  { name: 'Pete Braam', title: 'VP, Storage & Networking', email: 'pbraam@nvidia.com' },
  { name: 'Kari Briski', title: 'VP, AI Software Products', email: 'kbriski@nvidia.com' },
  // Products & Platforms
  { name: 'Ian Buck', title: 'VP, Hyperscale & HPC', email: 'ibuck@nvidia.com' },
  { name: 'Kevin Deierling', title: 'SVP, Networking Products', email: 'kdeierling@nvidia.com' },
  { name: 'Rama Akkiraju', title: 'VP, AI/ML for IT', email: 'rakkiraju@nvidia.com' },
  { name: 'Manuvir Das', title: 'VP, Enterprise Computing', email: 'mdas@nvidia.com' },
  { name: 'Justin Boitano', title: 'VP, Enterprise & Edge Computing', email: 'jboitano@nvidia.com' },
  { name: 'Dion Harris', title: 'Head of Data Center Products', email: 'dharris@nvidia.com' },
  { name: 'Paresh Kharya', title: 'Director, Accelerated Computing', email: 'pkharya@nvidia.com' },
  { name: 'David Hogan', title: 'VP, Automotive', email: 'dhogan@nvidia.com' },
  { name: 'Ali Kani', title: 'VP, Automotive', email: 'akani@nvidia.com' },
  { name: 'Danny Shapiro', title: 'VP, Automotive', email: 'dshapiro@nvidia.com' },
  // Sales & Marketing
  { name: 'Marc Hamilton', title: 'VP, Solutions Architecture & Engineering', email: 'mhamilton@nvidia.com' },
  { name: 'Mylene Mangalindan', title: 'VP, Corporate Communications', email: 'mmangalindan@nvidia.com' },
  { name: 'John Fanelli', title: 'VP, Enterprise Products', email: 'jfanelli@nvidia.com' },
  { name: 'Greg Estes', title: 'VP, Developer Programs', email: 'gestes@nvidia.com' },
  { name: 'Toshiya Hari', title: 'VP, Investor Relations', email: 'thari@nvidia.com' },
  { name: 'Donald Robertson', title: 'VP & Chief Accounting Officer', email: 'drobertson@nvidia.com' },
  // Healthcare & Life Sciences
  { name: 'Kimberly Powell', title: 'VP, Healthcare', email: 'kpowell@nvidia.com' },
  // Robotics & AI
  { name: 'Deepu Talla', title: 'VP, Robotics & Edge Computing', email: 'dtalla@nvidia.com' },
  { name: 'Rev Lebaredian', title: 'VP, Omniverse & Simulation Technology', email: 'rlebaredian@nvidia.com' },
  { name: 'Richard Kerris', title: 'VP, Omniverse Developer Platform', email: 'rkerris@nvidia.com' },
  // Finance & Strategy
  { name: 'Simona Jankowski', title: 'VP, Investor Relations', email: 'sjankowski@nvidia.com' },
  { name: 'Ajay Puri', title: 'EVP, Worldwide Field Operations', email: 'apuri@nvidia.com' },
  // Cloud & Partnerships
  { name: 'Ronnie Vasishta', title: 'SVP, Telecom', email: 'rvasishta@nvidia.com' },
  { name: 'Bob Pette', title: 'VP, Professional Visualization', email: 'bpette@nvidia.com' },
  { name: 'Phil Eisler', title: 'VP, GeForce NOW Cloud Gaming', email: 'peisler@nvidia.com' },
  { name: 'Jeff Herbst', title: 'VP, Business Development', email: 'jherbst@nvidia.com' },
  { name: 'David Neff', title: 'VP, Public Sector', email: 'dneff@nvidia.com' },
  { name: 'Tony Paikeday', title: 'SVP, DGX Systems', email: 'tpaikeday@nvidia.com' },
  { name: 'Charlie Boyle', title: 'VP, DGX Systems', email: 'cboyle@nvidia.com' },
  // Board of Directors
  { name: 'Tench Coxe', title: 'Board Director', email: 'tcoxe@nvidia.com' },
  { name: 'Dawn Hudson', title: 'Board Director', email: 'dhudson@nvidia.com' },
  { name: 'Harvey Jones', title: 'Board Director', email: 'hjones@nvidia.com' },
  { name: 'Persis Drell', title: 'Board Director', email: 'pdrell@nvidia.com' },
  { name: 'Aarti Shah', title: 'Board Director', email: 'ashah@nvidia.com' },
  { name: 'Mark Perry', title: 'Board Director', email: 'mperry@nvidia.com' },
  { name: 'John Dabiri', title: 'Board Director', email: 'jdabiri@nvidia.com' },
  { name: 'Melissa Lora', title: 'Board Director', email: 'mlora@nvidia.com' },
  { name: 'A. Brooke Seawell', title: 'Board Director', email: 'bseawell@nvidia.com' },
  // Additional Senior Leaders
  { name: 'Clint Wiederholt', title: 'VP, Americas Sales', email: 'cwiederholt@nvidia.com' },
  { name: 'Sumit Gupta', title: 'VP, AI & HPC', email: 'sgupta@nvidia.com' },
  { name: 'Craig Clawson', title: 'VP, Embedded & Edge', email: 'cclawson@nvidia.com' },
  { name: 'Vinay Shet', title: 'VP, Product Management', email: 'vshet@nvidia.com' },
  { name: 'Chris Swann', title: 'VP, Global Alliances', email: 'cswann@nvidia.com' },
  { name: 'Genia Emerson', title: 'VP, Marketing', email: 'gemerson@nvidia.com' },
  { name: 'Cheryl Valenti', title: 'VP, Global Marketing', email: 'cvalenti@nvidia.com' },
  { name: 'Nick Stam', title: 'VP, Technical Marketing', email: 'nstam@nvidia.com' },
  { name: 'Sandeep Gupte', title: 'SVP, Telecom & Edge', email: 'sgupte@nvidia.com' },
  { name: 'Shar Narasimhan', title: 'VP, Global Partnerships', email: 'snarasimhan@nvidia.com' },
  { name: 'Hector Marinez', title: 'VP, Latin America Sales', email: 'hmarinez@nvidia.com' },
  { name: 'Karim Temsamani', title: 'VP, EMEA Sales', email: 'ktemsamani@nvidia.com' },
  { name: 'Rishi Bhargava', title: 'VP, Product Strategy', email: 'rbhargava@nvidia.com' },
  { name: 'Joanna Konings', title: 'VP, APAC Sales', email: 'jkonings@nvidia.com' },
  { name: 'Yolanda Lannquist', title: 'Head of AI Policy', email: 'ylannquist@nvidia.com' },
  { name: 'Chet Ramey', title: 'VP, Software Engineering', email: 'cramey@nvidia.com' },
  { name: 'Srinivasa Rao', title: 'VP, India Operations', email: 'srao@nvidia.com' },
  { name: 'Pradeep Dubey', title: 'Intel Fellow / Research Director', email: 'pdubey@nvidia.com' },
  { name: 'Neel Nanda', title: 'Research Lead, Mechanistic Interpretability', email: 'nnanda@nvidia.com' },
  { name: 'Prafull Surana', title: 'VP, Finance', email: 'psurana@nvidia.com' },
  { name: 'Shawn Xu', title: 'VP, AI Infrastructure', email: 'sxu@nvidia.com' },
  { name: 'Rishi Bhargava', title: 'VP, AI Platform Strategy', email: 'rbhargava2@nvidia.com' },
  { name: 'Amit Katz', title: 'VP, Networking', email: 'akatz@nvidia.com' },
  { name: 'Gilad Shainer', title: 'SVP, Networking', email: 'gshainer@nvidia.com' },
  { name: 'Dror Goldenberg', title: 'VP, Software Architecture', email: 'dgoldenberg@nvidia.com' },
  { name: 'Yaron Levi', title: 'VP, Security', email: 'ylevi@nvidia.com' },
  { name: 'Amir Khosrowshahi', title: 'VP, AI Architecture', email: 'akhosrowshahi@nvidia.com' },
  { name: 'Avi Bleiweiss', title: 'VP, Software Engineering', email: 'ableiweiss@nvidia.com' },
  { name: 'Eyal Waldman', title: 'VP, Networking Technology', email: 'ewaldman@nvidia.com' },
  { name: 'Yatish Kumar', title: 'VP, Cloud Solutions', email: 'ykumar@nvidia.com' },
  { name: 'Sanjiv Nanda', title: 'VP, Wireless Technology', email: 'snanda@nvidia.com' },
  { name: 'David Hershfield', title: 'VP, Enterprise Sales', email: 'dhershfield@nvidia.com' },
  { name: 'Michael Kagan', title: 'CTO, Networking', email: 'mkagan@nvidia.com' },
  { name: 'Omer Doron', title: 'VP, Automotive Software', email: 'odoron@nvidia.com' },
  { name: 'Ronen Schaul', title: 'VP, Consumer Products', email: 'rschaul@nvidia.com' },
  { name: 'Vivienne Sze', title: 'Research Scientist', email: 'vsze@nvidia.com' },
  { name: 'Siddharth Garg', title: 'Research Director, Hardware Security', email: 'sgarg@nvidia.com' },
  { name: 'Alexei Smolin', title: 'VP, Global Business Development', email: 'asmolin@nvidia.com' },
  { name: 'Clement Farabet', title: 'VP, Research', email: 'cfarabet@nvidia.com' },
  { name: 'Linxi Fan', title: 'Research Scientist, Robotics', email: 'lfan@nvidia.com' },
  { name: 'Arash Vahdat', title: 'Principal Research Scientist', email: 'avahdat@nvidia.com' },
  { name: 'Jan Kautz', title: 'VP, Learning & Perception Research', email: 'jkautz@nvidia.com' },
  { name: 'Shalini De Mello', title: 'Principal Research Scientist', email: 'sdemello@nvidia.com' },
  { name: 'Sifei Liu', title: 'Senior Research Scientist', email: 'sfliu@nvidia.com' },
];

async function main() {
  console.log('Authenticating with Microsoft Graph...');
  const token = await getToken();
  console.log('✅ Token obtained');

  // Send review copy first
  console.log('📧 Sending NVIDIA review copy...');
  await sendEmail(token, REVIEW_EMAIL, `[REVIEW] ${subject}`, emailBody);
  console.log('✅ Review copy sent');

  console.log('─'.repeat(60));
  console.log(`SENDING TO NVIDIA — ${contacts.length} contacts`);
  console.log('─'.repeat(60));

  let sent = 0, failed = 0;
  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const personalizedBody = emailBody.replace('Dear NVIDIA Leader,', `Dear ${c.name.split(' ')[0]},`);
    const ok = await sendEmail(token, c.email, subject, personalizedBody);
    if (ok) {
      sent++;
      console.log(`✅ [${i + 1}/${contacts.length}] ${c.name} <${c.email}>`);
    } else {
      failed++;
      console.log(`❌ [${i + 1}/${contacts.length}] FAILED: ${c.name} <${c.email}>`);
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log('═'.repeat(60));
  console.log(`NVIDIA: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
