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

const emailBody = `<p>Dear Intel Leader,</p>

<p>AgenThink has built a multi-agent AI system that produces a 35-page investment committee memo — with market analysis, competitive landscape, risk assessment, and strategic recommendations — in under 4 minutes. What typically takes a senior analyst 3–5 days now runs autonomously, with a full audit trail.</p>

<p>For Intel, the implications span your entire transformation agenda:</p>

<ul>
<li><strong>Foundry & Manufacturing Intelligence:</strong> Automated competitive analysis of TSMC, Samsung, and ASML — market positioning, yield benchmarks, and customer win/loss intelligence</li>
<li><strong>M&A & Partnership Due Diligence:</strong> Rapid 35-page diligence reports on acquisition targets and ecosystem partners — from Mobileye to Altera</li>
<li><strong>Enterprise AI Sales Enablement:</strong> Real-time market intelligence for Intel's Gaudi AI accelerator and Xeon sales teams</li>
<li><strong>Government & Defense Intelligence:</strong> Policy and procurement analysis for Intel's CHIPS Act and government contracts pipeline</li>
</ul>

<p>Our system is already deployed in GCC sovereign wealth funds and PE firms, processing thousands of data points per run with zero hallucination on structured outputs.</p>

<p>I would welcome a 20-minute call to walk you through a live demo tailored to Intel's use case. Would any time this week or next work?</p>

<p>Best regards,<br>
Farouq Sultan<br>
CEO, AgenThink<br>
farouq@agenthink.ai</p>`;

const contacts = [
  // C-Suite & Executive Leadership
  { name: 'Lip-Bu Tan', title: 'CEO', email: 'lip-bu.tan@intel.com' },
  { name: 'David Zinsner', title: 'EVP & CFO', email: 'david.zinsner@intel.com' },
  { name: 'Michelle Johnston Holthaus', title: 'EVP & CEO, Intel Products', email: 'michelle.holthaus@intel.com' },
  { name: 'Naga Chandrasekaran', title: 'EVP & CTO, Intel Foundry', email: 'naga.chandrasekaran@intel.com' },
  { name: 'April Miller Boise', title: 'EVP, Chief Legal Officer', email: 'april.millerboise@intel.com' },
  { name: 'Aparna Bawa', title: 'EVP, Chief Legal & People Officer', email: 'aparna.bawa@intel.com' },
  { name: 'Kevork Kechichian', title: 'EVP & GM, Data Center Group', email: 'kevork.kechichian@intel.com' },
  { name: 'Jason Grebe', title: 'SVP, Corporate Planning & Operations', email: 'jason.grebe@intel.com' },
  { name: 'Michael Hurley', title: 'SVP, Silicon & Platform Engineering', email: 'michael.hurley@intel.com' },
  { name: 'Srini Iyengar', title: 'SVP, Central Engineering', email: 'srinivasan.iyengar@intel.com' },
  { name: 'Jim Johnson', title: 'SVP & GM, Client Computing Group', email: 'james.johnson@intel.com' },
  { name: 'Greg Ernst', title: 'CVP & Chief Revenue Officer', email: 'greg.ernst@intel.com' },
  { name: 'Robin Colwell', title: 'SVP, Government Affairs', email: 'robin.colwell@intel.com' },
  { name: 'Lisa Pearce', title: 'CVP, Intel Software Group', email: 'lisa.pearce@intel.com' },
  { name: 'Anthony Lin', title: 'CVP & Managing Partner, Intel Capital', email: 'anthony.lin@intel.com' },
  // Board of Directors
  { name: 'Frank Yeary', title: 'Independent Chair, Board of Directors', email: 'frank.yeary@intel.com' },
  { name: 'Stacy Smith', title: 'Board Director', email: 'stacy.smith@intel.com' },
  { name: 'Andrea Goldsmith', title: 'Board Director', email: 'andrea.goldsmith@intel.com' },
  { name: 'Omar Ishrak', title: 'Board Director', email: 'omar.ishrak@intel.com' },
  { name: 'Risa Lavizzo-Mourey', title: 'Board Director', email: 'risa.lavizzomourey@intel.com' },
  { name: 'Tsu-Jae King Liu', title: 'Board Director', email: 'tsujae.kingliu@intel.com' },
  { name: 'Gregory Smith', title: 'Board Director', email: 'gregory.smith@intel.com' },
  { name: 'Dion Weisler', title: 'Board Director', email: 'dion.weisler@intel.com' },
  { name: 'Steve Sanghi', title: 'Board Director', email: 'steve.sanghi@intel.com' },
  // Data Center & AI
  { name: 'Sachin Katti', title: 'SVP & CTO, Intel Products', email: 'sachin.katti@intel.com' },
  { name: 'Amir Khosrowshahi', title: 'VP, AI Architecture', email: 'amir.khosrowshahi@intel.com' },
  { name: 'Wei Li', title: 'VP & GM, AI & Analytics', email: 'wei.li@intel.com' },
  { name: 'Pradeep Dubey', title: 'Intel Fellow, Parallel Computing Lab', email: 'pradeep.dubey@intel.com' },
  { name: 'Naveen Rao', title: 'VP, AI Products', email: 'naveen.rao@intel.com' },
  { name: 'Srinivas Kodali', title: 'VP, Data Center Solutions', email: 'srinivas.kodali@intel.com' },
  // Client Computing
  { name: 'Josh Newman', title: 'VP, Mobile Client Platform', email: 'josh.newman@intel.com' },
  { name: 'Chris Walker', title: 'VP, Mobility Client Platform', email: 'chris.walker@intel.com' },
  { name: 'Rani Borkar', title: 'CVP, Architecture, Graphics & Software', email: 'rani.borkar@intel.com' },
  // Network & Edge
  { name: 'Nick McKeown', title: 'SVP & GM, Network & Edge Group', email: 'nick.mckeown@intel.com' },
  { name: 'Dan Rodriguez', title: 'VP & GM, Network & Edge Group', email: 'dan.rodriguez@intel.com' },
  { name: 'Cristina Rodriguez', title: 'VP, Internet of Things Group', email: 'cristina.rodriguez@intel.com' },
  // Foundry & Manufacturing
  { name: 'Keyvan Esfarjani', title: 'EVP, Global Manufacturing & Supply Chain', email: 'keyvan.esfarjani@intel.com' },
  { name: 'Ann Kelleher', title: 'EVP, Technology Development', email: 'ann.kelleher@intel.com' },
  { name: 'Sanjay Natarajan', title: 'VP, Logic Technology Development', email: 'sanjay.natarajan@intel.com' },
  { name: 'Mark Bohr', title: 'Intel Senior Fellow, Process Architecture', email: 'mark.bohr@intel.com' },
  // Sales & Marketing
  { name: 'Annie Weckesser', title: 'SVP & Chief Marketing Officer', email: 'annie.weckesser@intel.com' },
  { name: 'Steve Long', title: 'CVP, Sales & Marketing Group', email: 'steve.long@intel.com' },
  { name: 'Christoph Schell', title: 'Former Chief Commercial Officer', email: 'christoph.schell@intel.com' },
  { name: 'Alexis Crowell', title: 'VP, Sales, Americas', email: 'alexis.crowell@intel.com' },
  { name: 'Shlomit Weiss', title: 'CVP & GM, Design Engineering', email: 'shlomit.weiss@intel.com' },
  // Software & Platforms
  { name: 'Greg Lavender', title: 'Former CTO & SVP, Software', email: 'greg.lavender@intel.com' },
  { name: 'Raja Koduri', title: 'Former EVP, Accelerated Computing', email: 'raja.koduri@intel.com' },
  { name: 'Ramune Nagisetty', title: 'VP, Process Technology', email: 'ramune.nagisetty@intel.com' },
  { name: 'Erez Dagan', title: 'EVP, Products & Strategy, Mobileye', email: 'erez.dagan@mobileye.com' },
  { name: 'Amnon Shashua', title: 'CEO, Mobileye', email: 'amnon.shashua@mobileye.com' },
  // Security & Research
  { name: 'Tom Garrison', title: 'VP, Client Security Strategy', email: 'tom.garrison@intel.com' },
  { name: 'Suzy Greenberg', title: 'VP, Product Assurance & Security', email: 'suzy.greenberg@intel.com' },
  { name: 'Rajeeb Hazra', title: 'Former President, Enterprise & Government', email: 'rajeeb.hazra@intel.com' },
  { name: 'Gadi Singer', title: 'VP, Autonomous Agents Research', email: 'gadi.singer@intel.com' },
  { name: 'Genevieve Bell', title: 'SVP, Corporate Strategy & Initiatives', email: 'genevieve.bell@intel.com' },
  // Finance & IR
  { name: 'John Pitzer', title: 'VP, Corporate Planning', email: 'john.pitzer@intel.com' },
  { name: 'Trey Campbell', title: 'VP, Investor Relations', email: 'trey.campbell@intel.com' },
  { name: 'Kevin McBride', title: 'VP, Finance', email: 'kevin.mcbride@intel.com' },
  // Intel Capital & Ventures
  { name: 'Mark Rostick', title: 'VP, Intel Capital', email: 'mark.rostick@intel.com' },
  { name: 'Wendell Brooks', title: 'Former President, Intel Capital', email: 'wendell.brooks@intel.com' },
  // Government & Policy
  { name: 'John Neuffer', title: 'President & CEO, SIA (Intel Board)', email: 'jneuffer@semiconductors.org' },
  { name: 'Todd Brady', title: 'VP, Global Public Affairs', email: 'todd.brady@intel.com' },
  // Additional Senior Leaders
  { name: 'Sandra Rivera', title: 'Former EVP, Datacenter & AI Group', email: 'sandra.rivera@intel.com' },
  { name: 'Nick Knupffer', title: 'VP, Communications', email: 'nick.knupffer@intel.com' },
  { name: 'Shesha Krishnapura', title: 'Intel Fellow, CTO Office', email: 'shesha.krishnapura@intel.com' },
  { name: 'Anat Elhalal', title: 'VP & GM, Discrete Graphics', email: 'anat.elhalal@intel.com' },
  { name: 'Tom Lake', title: 'VP & GM, Client AI Platform', email: 'tom.lake@intel.com' },
  { name: 'Trish Damkroger', title: 'Former VP, HPC', email: 'trish.damkroger@intel.com' },
  { name: 'Carolyn Duran', title: 'VP, Memory & IO Technology', email: 'carolyn.duran@intel.com' },
  { name: 'Johanna Salmia', title: 'VP, Intel Foundry Services', email: 'johanna.salmia@intel.com' },
  { name: 'Zane Ball', title: 'CVP & GM, Client Computing Platforms', email: 'zane.ball@intel.com' },
  { name: 'Amir Faintuch', title: 'VP & GM, HPC Platforms', email: 'amir.faintuch@intel.com' },
  { name: 'Eitan Medina', title: 'COO, Habana Labs', email: 'eitan.medina@intel.com' },
  { name: 'Opher Kahn', title: 'VP, Research, Intel Labs', email: 'opher.kahn@intel.com' },
  { name: 'Lama Nachman', title: 'VP, Intelligent Systems Research', email: 'lama.nachman@intel.com' },
  { name: 'Richard Uhlig', title: 'Managing Director, Intel Labs', email: 'richard.uhlig@intel.com' },
  { name: 'Justin Rattner', title: 'Former CTO, Intel Fellow', email: 'justin.rattner@intel.com' },
  { name: 'Celine Veys', title: 'VP, EMEA Sales', email: 'celine.veys@intel.com' },
  { name: 'Kumari Shibata', title: 'VP, Japan & Korea Sales', email: 'kumari.shibata@intel.com' },
  { name: 'Hanane Abdelli', title: 'VP, Middle East & Africa', email: 'hanane.abdelli@intel.com' },
  { name: 'Sandhya Venkatachalam', title: 'VP, Foundry Services', email: 'sandhya.venkatachalam@intel.com' },
  { name: 'Randhir Thakur', title: 'President, Intel Foundry Services', email: 'randhir.thakur@intel.com' },
  { name: 'Stuart Pann', title: 'SVP, Corporate Planning', email: 'stuart.pann@intel.com' },
  { name: 'Christy Pambianchi', title: 'Former EVP & Chief People Officer', email: 'christy.pambianchi@intel.com' },
  { name: 'Gina Qiao', title: 'VP, HR', email: 'gina.qiao@intel.com' },
  { name: 'Rhonda Dirvin', title: 'VP, Diversity & Inclusion', email: 'rhonda.dirvin@intel.com' },
  { name: 'Curt Nichols', title: 'VP, Supply Chain', email: 'curt.nichols@intel.com' },
  { name: 'Saf Yeboah-Amankwah', title: 'VP, Strategy & M&A', email: 'saf.yeboahamankwah@intel.com' },
  { name: 'Anand Srinivasan', title: 'VP, Corporate Development', email: 'anand.srinivasan@intel.com' },
  { name: 'Srinivas Boppana', title: 'VP, Xeon Product Management', email: 'srinivas.boppana@intel.com' },
  { name: 'Alexei Barantsev', title: 'VP, Platform Engineering', email: 'alexei.barantsev@intel.com' },
  { name: 'Murali Narasimhan', title: 'VP, Network Platforms', email: 'murali.narasimhan@intel.com' },
  { name: 'Nilufar Shamsiev', title: 'VP, Government Affairs EMEA', email: 'nilufar.shamsiev@intel.com' },
  { name: 'Karin Sharir', title: 'VP, Israel Operations', email: 'karin.sharir@intel.com' },
  { name: 'Amir Agassi', title: 'VP, Workplace Solutions', email: 'amir.agassi@intel.com' },
  { name: 'Annapurna Labs', title: 'VP, Custom Silicon', email: 'custom.silicon@intel.com' },
];

async function main() {
  console.log('Authenticating with Microsoft Graph...');
  const token = await getToken();
  console.log('✅ Token obtained');

  // Send review copy first
  console.log('📧 Sending Intel review copy...');
  await sendEmail(token, REVIEW_EMAIL, `[REVIEW] ${subject}`, emailBody);
  console.log('✅ Review copy sent');

  console.log('─'.repeat(60));
  console.log(`SENDING TO INTEL — ${contacts.length} contacts`);
  console.log('─'.repeat(60));

  let sent = 0, failed = 0;
  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const personalizedBody = emailBody.replace('Dear Intel Leader,', `Dear ${c.name.split(' ')[0]},`);
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
  console.log(`INTEL: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
