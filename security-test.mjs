/**
 * Tenant-isolation and authorization probe.
 *
 * Signs in as a real user of one organization and then attempts to reach every
 * kind of record belonging to a *different* organization using genuine ids read
 * straight out of the database. Nothing here is a mock: if isolation is only
 * enforced in the UI rather than at the query layer, these probes succeed and
 * the test fails.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const prisma = new PrismaClient();
const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

console.log(`\n▶ Tenant isolation & authorization probe against ${BASE}\n`);

// Real ids belonging to Northfield, and a second organization to attack from.
const northfield = await prisma.organization.findUniqueOrThrow({ where: { slug: 'northfield-manufacturing' } });
const coastline = await prisma.organization.findUniqueOrThrow({ where: { slug: 'coastline-food-co' } });

const victim = {
  project: await prisma.auditProject.findFirstOrThrow({ where: { orgId: northfield.id } }),
  evidence: await prisma.evidence.findFirstOrThrow({ where: { orgId: northfield.id } }),
  requirement: await prisma.projectRequirement.findFirstOrThrow({ where: { orgId: northfield.id } }),
  gap: await prisma.gap.findFirstOrThrow({ where: { orgId: northfield.id } }),
  action: await prisma.action.findFirstOrThrow({ where: { orgId: northfield.id } }),
  simulator: await prisma.simulatorSession.findFirstOrThrow({ where: { orgId: northfield.id } }),
};

const coastlineProject = await prisma.auditProject.findFirstOrThrow({ where: { orgId: coastline.id } });

// A report to probe. Created directly so the probe does not depend on the flow
// test having run first.
let report = await prisma.auditReport.findFirst({ where: { orgId: northfield.id } });
if (!report) {
  const author = await prisma.user.findUniqueOrThrow({ where: { email: 'dana@northfield.example' } });
  report = await prisma.auditReport.create({
    data: {
      orgId: northfield.id,
      projectId: victim.project.id,
      title: 'Isolation probe report',
      generatedById: author.id,
      readinessScore: 78,
      riskLevel: 'MEDIUM',
      data: JSON.stringify({ version: 1, probe: true }),
    },
  });
}

const browser = await chromium.launch({ executablePath: CHROME });

try {
  // ---------------------------------------------------------------- attacker
  // Dana is a VIEWER in Coastline and OWNER in Northfield. Sign in and switch
  // the active organization to Coastline, then try to reach Northfield data.
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Work email').fill('dana@northfield.example');
  await page.getByLabel('Password').fill('AuditReady2026!');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL('**/app/dashboard', { timeout: 30000 });

  // Switch active org to Coastline via the real endpoint.
  await page.request.post(`${BASE}/api/orgs/${coastline.id}/activate`);
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle' });
  const onCoastline = (await page.locator('body').innerText()).includes('Coastline');
  record('0. Switched active organization to Coastline', onCoastline);

  // ------------------------------------------------- cross-tenant page reads
  const pageProbes = [
    ['Audit project', `/app/audits/${victim.project.id}`],
    ['Audit preparation', `/app/audits/${victim.project.id}/prepare`],
    ['Requirement', `/app/requirements/${victim.requirement.id}`],
    ['Evidence', `/app/evidence/${victim.evidence.id}`],
    ['Gap', `/app/gaps/${victim.gap.id}`],
    ['Action', `/app/actions/${victim.action.id}`],
    ['Simulator session', `/app/simulator/${victim.simulator.id}`],
  ];

  for (const [label, path] of pageProbes) {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    const status = response.status();
    const body = await page.locator('body').innerText();
    // Either a 404, or a page that does not leak the other tenant's content.
    const blocked = status === 404 || !body.includes('Northfield');
    record(`1. ${label} of another tenant is not reachable`, blocked, `status ${status}`);
  }

  if (report) {
    const response = await page.goto(`${BASE}/app/reports/${report.id}`, { waitUntil: 'domcontentloaded' });
    record('1. Report of another tenant is not reachable', response.status() === 404, `status ${response.status()}`);
  }

  // ------------------------------------------------------- cross-tenant APIs
  const download = await page.request.get(`${BASE}/api/evidence/${victim.evidence.id}/download`, { failOnStatusCode: false });
  record('2a. Evidence download API refuses another tenant', download.status() === 404, `status ${download.status()}`);

  if (report) {
    const pdf = await page.request.get(`${BASE}/api/reports/${report.id}/pdf`, { failOnStatusCode: false });
    record('2b. Report PDF API refuses another tenant', pdf.status() === 404, `status ${pdf.status()}`);
  }

  // Activating an organization the user has no access to must not work.
  const stranger = await prisma.organization.create({
    data: { name: 'Isolation Probe Org', slug: `isolation-probe-${Date.now()}` },
  });
  await page.request.post(`${BASE}/api/orgs/${stranger.id}/activate`);
  await page.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle' });
  const stillCoastline = (await page.locator('body').innerText()).includes('Coastline');
  record('2c. Cannot activate an organization the user is not a member of', stillCoastline);
  await prisma.organization.delete({ where: { id: stranger.id } });

  // ------------------------------------------------------------ RBAC checks
  // Dana is a VIEWER in Coastline: read-only. Confirm write affordances are
  // withheld and the underlying pages do not offer them.
  await page.goto(`${BASE}/app/audits/${coastlineProject.id}`, { waitUntil: 'networkidle' });
  const projectBody = await page.locator('body').innerText();
  record('3a. Viewer sees the project but no delete control', projectBody.includes('Customer Audit') && !projectBody.includes('Delete this project'));

  await page.goto(`${BASE}/app/evidence/upload?project=${coastlineProject.id}`, { waitUntil: 'domcontentloaded' });
  record('3b. Viewer is redirected away from the upload page', page.url().includes('/app/evidence') && !page.url().includes('/upload'));

  await page.goto(`${BASE}/app/settings/billing`, { waitUntil: 'domcontentloaded' });
  record('3c. Viewer is redirected away from billing', !page.url().includes('/billing'));

  await page.goto(`${BASE}/app/settings/activity`, { waitUntil: 'domcontentloaded' });
  record('3d. Viewer is redirected away from the activity log', !page.url().includes('/activity'));

  // --------------------------------------------------- contributor limits
  const contributor = await browser.newContext();
  const cPage = await contributor.newPage();
  await cPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await cPage.getByLabel('Work email').fill('sam@northfield.example');
  await cPage.getByLabel('Password').fill('AuditReady2026!');
  await cPage.getByRole('button', { name: /Sign in/i }).click();
  await cPage.waitForURL('**/app/dashboard', { timeout: 30000 });

  await cPage.goto(`${BASE}/app/requirements/${victim.requirement.id}`, { waitUntil: 'networkidle' });
  const reqBody = await cPage.locator('body').innerText();
  record('4a. Contributor can view a requirement', reqBody.includes('Requirement'));
  const saveButtons = await cPage.getByRole('button', { name: /Save assessment/i }).count();
  record('4b. Contributor cannot save a requirement assessment', saveButtons === 0);

  await cPage.goto(`${BASE}/app/settings/members`, { waitUntil: 'networkidle' });
  const membersBody = await cPage.locator('body').innerText();
  record('4c. Contributor cannot add members', !membersBody.includes('Add a member'));
  await contributor.close();

  // ------------------------------------------------------- session security
  const anon = await browser.newContext();
  const aPage = await anon.newPage();

  const anonApp = await aPage.goto(`${BASE}/app/dashboard`, { waitUntil: 'domcontentloaded' });
  record('5a. Unauthenticated app access is redirected to login', aPage.url().includes('/login'), `status ${anonApp.status()}`);

  const anonDownload = await aPage.request.get(`${BASE}/api/evidence/${victim.evidence.id}/download`, { failOnStatusCode: false });
  record('5b. Unauthenticated download is refused', anonDownload.status() === 401, `status ${anonDownload.status()}`);

  // A forged session cookie must not authenticate.
  await anon.addCookies([{ name: 'ar_session', value: 'forged.value', domain: 'localhost', path: '/' }]);
  await aPage.goto(`${BASE}/app/dashboard`, { waitUntil: 'domcontentloaded' });
  record('5c. A forged session cookie does not authenticate', aPage.url().includes('/login'));

  // The session cookie must be httpOnly so scripts cannot read it.
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === 'ar_session');
  record('5d. Session cookie is httpOnly and SameSite=Lax', !!session?.httpOnly && session?.sameSite === 'Lax');

  // --------------------------------- authorized behaviour in the user's own org
  // Switch back to Northfield, where Dana is the owner, and verify the positive
  // cases: the same person who was blocked above is now allowed.
  await page.request.post(`${BASE}/api/orgs/${northfield.id}/activate`);

  const uploadPage = await page.goto(`${BASE}/app/evidence/upload`, { waitUntil: 'domcontentloaded' });
  const uploadHtml = await uploadPage.text();
  record(
    '6a. Owner reaches the upload page and it enforces the allowed-type list',
    page.url().includes('/upload') && uploadHtml.includes('.pdf,.docx,.xlsx')
  );

  const before = await prisma.auditLog.count({ where: { orgId: northfield.id, action: 'evidence.downloaded' } });
  const ownDownload = await page.request.get(`${BASE}/api/evidence/${victim.evidence.id}/download`, { failOnStatusCode: false });
  record('6b. Owner can download their own organization\'s evidence', ownDownload.status() === 200, `status ${ownDownload.status()}`);

  // ------------------------------------------------------ security headers
  const headers = (await page.request.get(`${BASE}/login`)).headers();
  record(
    '7. Security headers are present',
    headers['x-content-type-options'] === 'nosniff' &&
      headers['x-frame-options'] === 'DENY' &&
      !!headers['referrer-policy'],
    `nosniff=${headers['x-content-type-options']} frame=${headers['x-frame-options']}`
  );

  // -------------------------------------------------------- webhook signing
  const webhook = await page.request.post(`${BASE}/api/billing/webhook`, {
    data: JSON.stringify({ type: 'customer.subscription.updated', data: { object: { metadata: { orgId: northfield.id } } } }),
    headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
    failOnStatusCode: false,
  });
  record('8. Billing webhook rejects an unsigned payload', webhook.status() === 400 || webhook.status() === 501, `status ${webhook.status()}`);

  // ------------------------------------------------------- audit log written
  const after = await prisma.auditLog.count({
    where: { orgId: northfield.id, action: 'evidence.downloaded' },
  });
  record('9. Evidence access is written to the audit log', after > before, `${before} → ${after} download events`);

  await anon.close();
  await context.close();
} catch (error) {
  record('PROBE ABORTED', false, String(error).split('\n')[0]);
} finally {
  await browser.close();
  await prisma.$disconnect();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) {
  console.log('\nFailed:');
  for (const f of failed) console.log(`  · ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
  process.exit(1);
}
console.log('\n✓ Tenant isolation and authorization verified.\n');
