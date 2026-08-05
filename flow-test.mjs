/**
 * End-to-end user-flow test.
 *
 * Drives the real UI in Chromium through the whole advertised path:
 * signup → organization → audit project → evidence upload → AI analysis →
 * gap detection → action → report, plus tenant isolation and role checks.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const SHOTS = process.env.SHOTS ?? null;

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const stamp = Date.now();
const EMAIL = `flowtest+${stamp}@example.com`;
const PASSWORD = 'FlowTest-Harbor-2026';
const ORG = `Flow Test Works ${stamp}`;

const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: CHROME });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

const consoleErrors = [];
const failedRequests = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err}`));
page.on('response', (res) => {
  if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
});

async function shot(name) {
  if (!SHOTS) return;
  await fs.mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

console.log(`\n▶ End-to-end user-flow test against ${BASE}\n`);

try {
  // 0 — Landing page ---------------------------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const heroVisible = await page.getByRole('heading', { name: /Know you.re ready/i }).isVisible();
  const hasPricing = await page.locator('#pricing').count();
  record('0. Landing page renders hero, mockup and pricing', heroVisible && hasPricing > 0);
  await shot('00-landing');

  // 1 — Signup ---------------------------------------------------------------
  await page.getByRole('link', { name: 'Check your readiness' }).first().click();
  await page.waitForURL('**/signup');
  await page.getByLabel('Full name').fill('Flow Tester');
  await page.getByLabel('Job title').fill('Quality Manager');
  await page.getByLabel('Work email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL('**/onboarding', { timeout: 30000 });
  record('1. Sign up creates an account and lands on onboarding', page.url().includes('/onboarding'));
  await shot('01-onboarding');

  // 2 — Create organization --------------------------------------------------
  await page.getByLabel('Organization name').fill(ORG);
  await page.getByLabel('Industry').selectOption('Manufacturing');
  await page.getByLabel('Employees').selectOption('11–50');
  await page.getByRole('button', { name: /Create organization/i }).click();
  await page.waitForURL('**/app/audits/new**', { timeout: 30000 });
  record('2. Organization created; routed to first audit project', page.url().includes('/app/audits/new'));

  // 3 — Create audit project -------------------------------------------------
  const frameworkVisible = await page.getByText('Demo Quality Management Framework').first().isVisible();
  record('3a. Bundled frameworks are offered', frameworkVisible);
  await shot('02-new-audit');

  await page.getByLabel('Project name').fill('Flow Test Certification Audit');
  await page.getByRole('button', { name: /Demo Quality Management Framework/ }).first().click();
  await page.getByLabel('Audit type').selectOption('CERTIFICATION');
  const auditDate = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel('Audit date').fill(auditDate);
  await page.getByRole('button', { name: /Create audit project/i }).click();
  await page.waitForURL(/\/app\/audits\/c[a-z0-9]+/, { timeout: 40000 });
  const projectId = page.url().match(/\/app\/audits\/(c[a-z0-9]+)/)[1];
  record('3b. Audit project created', !!projectId, `project ${projectId.slice(0, 10)}…`);
  await shot('03-project');

  // 4 — Requirements imported ------------------------------------------------
  await page.goto(`${BASE}/app/requirements?project=${projectId}`, { waitUntil: 'networkidle' });
  const hasRequirement = await page.getByText('DEMO-7.2').first().isVisible();
  const hasCompetence = await page.getByText('Competence').first().isVisible();
  record('4. Requirements imported into the project', hasRequirement && hasCompetence);
  await shot('04-requirements');

  // 5 — Upload evidence ------------------------------------------------------
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowtest-'));
  const csvPath = path.join(tmpDir, 'Flow Test Training Matrix.csv');
  await fs.writeFile(
    csvPath,
    [
      'Employee,Role,Required Training,Completed,Assessed By,Next Refresher',
      'A. Rivers,CNC Operator,Machine Setting,2026-03-04,T. Bassey,2027-03-04',
      'B. Nkemi,CNC Operator,In-Process Inspection,,,',
      'C. Duval,Inspector,Final Inspection Procedure,2026-01-19,D. Whitfield,2027-01-19',
      'D. Song,CNC Operator,Manual Handling,TBD,,',
      'E. Marchetti,Inspector,Gauge Handling and Calibration Awareness,,,',
    ].join('\n')
  );

  await page.goto(`${BASE}/app/evidence/upload?project=${projectId}`, { waitUntil: 'networkidle' });
  await page.setInputFiles('input[name="files"]', csvPath);
  await page.getByLabel('Document type').selectOption('training_record');
  await page.getByLabel('Tags').fill('flow-test, training');
  await page.getByRole('button', { name: /Upload 1 file/i }).click();
  await page.waitForSelector('text=/Uploaded 1 file/i', { timeout: 60000 });
  record('5. Evidence uploaded and text extracted', true);
  await shot('05-uploaded');

  // 6 — AI analysis ----------------------------------------------------------
  await page.goto(`${BASE}/app/evidence?project=${projectId}`, { waitUntil: 'networkidle' });
  const evidenceLink = page.locator('a[href^="/app/evidence/c"]').first();
  await evidenceLink.click();
  await page.waitForURL(/\/app\/evidence\/c[a-z0-9]+/);
  const evidenceId = page.url().match(/\/app\/evidence\/(c[a-z0-9]+)/)[1];

  await page.getByRole('button', { name: /^Analyze$/ }).click();
  await page.waitForSelector('text=Linked requirements', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'networkidle' });

  const bodyText = await page.locator('body').innerText();
  const analyzed = /ai assessment/i.test(bodyText) && /confidence/i.test(bodyText);
  const matched = /DEMO-\d/.test(bodyText);
  const caveat = bodyText.includes('Human verification recommended');
  record('6a. AI analysis produced an assessment with confidence', analyzed);
  record('6b. Analysis matched the document to requirements', matched);
  record('6c. AI conclusion carries the human-verification caveat', caveat);
  await shot('06-analysis');

  // 6d — approve a suggested link -------------------------------------------
  const approve = page.getByRole('button', { name: /^Approve$/ }).first();
  const hadApprove = (await approve.count()) > 0;
  if (hadApprove) {
    await approve.click();
    await page.waitForTimeout(2500);
  }
  const afterApprove = await page.locator('body').innerText();
  record('6d. A suggested match can be approved by a human', hadApprove && afterApprove.includes('Human verified'));

  // 7 — Gap detection --------------------------------------------------------
  await page.goto(`${BASE}/app/gaps?project=${projectId}`, { waitUntil: 'networkidle' });
  const gapText = await page.locator('body').innerText();
  const gapsFound = /No evidence linked to DEMO-/.test(gapText) || /Incomplete|Missing|expired/i.test(gapText);
  record('7. Gap detection produced findings', gapsFound);
  await shot('07-gaps');

  // 8 — Matrix ---------------------------------------------------------------
  await page.goto(`${BASE}/app/matrix?project=${projectId}`, { waitUntil: 'networkidle' });
  const matrixText = await page.locator('body').innerText();
  const matrixOk = /ai assessment/i.test(matrixText) && /human review/i.test(matrixText);
  await page.locator('tbody tr').first().click();
  await page.waitForTimeout(600);
  const panelOpen = await page.getByRole('dialog').isVisible().catch(() => false);
  record('8. Matrix renders and the detail panel opens', matrixOk && panelOpen);
  await shot('08-matrix');

  // 9 — Gap → action ---------------------------------------------------------
  await page.goto(`${BASE}/app/gaps?project=${projectId}`, { waitUntil: 'networkidle' });
  await page.locator('a[href^="/app/gaps/c"]').first().click();
  await page.waitForURL(/\/app\/gaps\/c[a-z0-9]+/);

  // AI-drafted action first, then save it.
  const generate = page.getByRole('button', { name: /Generate recommended action/i });
  const hasGenerate = (await generate.count()) > 0;
  if (hasGenerate) {
    await generate.click();
    await page.waitForSelector('text=/Draft generated/i', { timeout: 60000 });
  }
  record('9a. AI drafts a recommended action from the gap', hasGenerate);

  await page.getByRole('button', { name: /^Create action$/ }).last().click();
  await page.waitForURL(/\/app\/actions\/c[a-z0-9]+/, { timeout: 40000 });
  const actionText = await page.locator('body').innerText();
  record('9b. Gap converted into a tracked action', /CA-\d{4}/.test(actionText));
  await shot('09-action');

  // 9c — progress the action -------------------------------------------------
  await page.getByLabel('Status').selectOption('IN_PROGRESS');
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(2500);
  record('9c. Action status can be progressed', (await page.locator('body').innerText()).includes('In progress'));

  // 10 — Preparation plan ----------------------------------------------------
  await page.goto(`${BASE}/app/audits/${projectId}/prepare`, { waitUntil: 'networkidle' });
  const prepText = await page.locator('body').innerText();
  record('10. Preparation plan ranks priorities with a countdown', prepText.includes('Your top 10 priorities') && /days until audit/i.test(prepText));
  await shot('10-prepare');

  // 11 — Report + PDF --------------------------------------------------------
  await page.goto(`${BASE}/app/reports?project=${projectId}`, { waitUntil: 'networkidle' });
  await page.getByLabel('Report title').fill('Flow test preparation report');
  await page.getByRole('button', { name: /Generate report/i }).click();
  await page.waitForURL(/\/app\/reports\/c[a-z0-9]+/, { timeout: 60000 });
  const reportId = page.url().match(/\/app\/reports\/(c[a-z0-9]+)/)[1];
  const reportText = await page.locator('body').innerText();
  record(
    '11a. Report generated with statistics, gaps and disclaimer',
    /does not constitute certification/i.test(reportText) && /recommendations/i.test(reportText)
  );
  await shot('11-report');

  const pdfResponse = await page.request.get(`${BASE}/api/reports/${reportId}/pdf`);
  const pdfBuffer = Buffer.from(await pdfResponse.body());
  record(
    '11b. PDF export returns a real PDF',
    pdfResponse.status() === 200 && pdfBuffer.subarray(0, 5).toString() === '%PDF-',
    `${(pdfBuffer.length / 1024).toFixed(0)} KB`
  );

  // 12 — Search --------------------------------------------------------------
  await page.goto(`${BASE}/app/search?q=training`, { waitUntil: 'networkidle' });
  const searchText = await page.locator('body').innerText();
  record('12. Global search finds document contents', searchText.includes('Flow Test Training Matrix'));
  await shot('12-search');

  // 13 — Dashboard -----------------------------------------------------------
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle' });
  const dashText = await page.locator('body').innerText();
  const hasScore = /\d+%/.test(dashText) && /audit readiness/i.test(dashText);
  record('13. Dashboard shows a readiness score and breakdown', hasScore && /requirement status/i.test(dashText));
  await shot('13-dashboard');

  // 14 — Simulator gating ----------------------------------------------------
  await page.goto(`${BASE}/app/simulator?project=${projectId}`, { waitUntil: 'networkidle' });
  const simText = await page.locator('body').innerText();
  record('14. Simulator gated behind the Professional plan on a trial', /ask me like an auditor/i.test(simText) && /included on professional/i.test(simText));

  // 15 — Tenant isolation ----------------------------------------------------
  record('15a. Seeded tenant data is not visible to this new org', !dashText.includes('Northfield'));

  const foreignEvidence = await page.request.get(`${BASE}/api/evidence/clfakeidfakeidfakeid00/download`, { failOnStatusCode: false });
  record('15b. Evidence id outside the tenant is refused', foreignEvidence.status() === 404, `status ${foreignEvidence.status()}`);

  // 16 — Sign in as a seeded user and confirm isolation the other way --------
  const other = await context.browser().newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await otherPage.getByLabel('Work email').fill('dana@northfield.example');
  await otherPage.getByLabel('Password').fill('AuditReady2026!');
  await otherPage.getByRole('button', { name: /Sign in/i }).click();
  await otherPage.waitForURL('**/app/dashboard', { timeout: 30000 });
  const otherText = await otherPage.locator('body').innerText();
  record('16a. Seeded account signs in to its own workspace', otherText.includes('Northfield Manufacturing'));
  record('16b. Seeded workspace does not show the flow-test org', !otherText.includes('Flow Test Works'));

  const crossEvidence = await otherPage.request.get(`${BASE}/api/evidence/${evidenceId}/download`, { failOnStatusCode: false });
  record('16c. Cross-tenant evidence download is refused', crossEvidence.status() === 404, `status ${crossEvidence.status()}`);

  const crossProject = await otherPage.goto(`${BASE}/app/audits/${projectId}`, { waitUntil: 'domcontentloaded' });
  record('16d. Cross-tenant project page is not found', crossProject.status() === 404, `status ${crossProject.status()}`);
  await other.close();

  // 17 — Responsive ----------------------------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle' });
  const menuButton = await page.getByRole('button', { name: 'Open navigation' }).isVisible();
  const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
  record('17a. Mobile app shell shows the menu and does not scroll sideways', menuButton && noHorizontalScroll);
  await shot('17-mobile-dashboard');

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const landingNoScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
  record('17b. Landing page fits a 390px viewport', landingNoScroll);
  await shot('17-mobile-landing');

  // 18 — Console cleanliness -------------------------------------------------
  // Deliberate 4xx probes made by this test are expected; anything else is not.
  const unexpected = failedRequests.filter((r) => !/(clfakeidfakeidfakeid00|does-not-exist|\/app\/audits\/c)/.test(r));
  record('18a. No unexpected failing requests', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));

  const realErrors = consoleErrors.filter(
    (e) => !/favicon|React DevTools|Failed to load resource/i.test(e)
  );
  record('18b. No client-side JavaScript errors', realErrors.length === 0, realErrors.slice(0, 2).join(' | '));
} catch (error) {
  record('FLOW ABORTED', false, String(error).split('\n')[0]);
  await shot('99-failure');
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) {
  console.log('\nFailed:');
  for (const f of failed) console.log(`  · ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
  process.exit(1);
}
console.log('\n✓ Full flow verified end to end.\n');
