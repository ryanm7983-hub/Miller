// Drive an exported web build the way a phone would, and assert on what a
// player could actually do with it.
//
//   node tools/verify-web.js <url> [outdir]
//
// This exists because every input bug that has shipped from this project was
// invisible on a desktop and invisible in a screenshot. The checks below are the
// ones that would have caught them: what sits under the middle of the canvas,
// whether a touch — with no mouse anywhere in the session — starts the game, and
// whether a build that cannot load says so instead of sitting on the loading
// screen forever.
//
// Needs Playwright and a Chromium; PLAYWRIGHT_CHROMIUM may point at one.

const path = require('path');

const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = require(PLAYWRIGHT);

const BASE = process.argv[2];
const OUT = process.argv[3] || '.';
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;

const PHONE = {
	viewport: { width: 390, height: 844 },   // portrait, the failing orientation
	deviceScaleFactor: 3,
	isMobile: true,
	hasTouch: true,
};

let failures = 0;
function check(ok, what) {
	console.log((ok ? '  ok    ' : '  FAIL  ') + what);
	if (!ok) { failures += 1; }
}

async function newPage(browser, overrides) {
	const context = await browser.newContext(Object.assign({}, PHONE, overrides));
	const page = await context.newPage();
	const stages = [];
	await page.exposeFunction('__report', (s) => stages.push(s));
	await page.addInitScript(() => {
		Object.defineProperty(window, 'blackPineStage', {
			configurable: true,
			set(fn) { this.__real = fn; },
			get() {
				return (s) => { window.__report(s); if (this.__real) { this.__real(s); } };
			},
		});
	});
	return { page, stages };
}

async function waitFor(predicate, timeoutMs, stepMs) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await predicate()) { return true; }
		await new Promise((r) => setTimeout(r, stepMs || 1000));
	}
	return false;
}

async function testTouchStartsTheGame(browser) {
	console.log('\nportrait phone, touch input only');
	const { page, stages } = await newPage(browser, {});
	await page.goto(BASE, { waitUntil: 'load', timeout: 180000 });

	const started = await waitFor(
		() => page.evaluate(() => document.body.classList.contains('playing')), 300000);
	check(started, 'the engine starts');
	if (!started) { return; }
	await page.waitForTimeout(3000);

	// The bug that made this build unplayable was an overlay the canvas could
	// not be reached through. Nothing may sit over the middle of the screen.
	const centre = await page.evaluate(
		() => (document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) || {}).id);
	check(centre === 'canvas', 'the canvas is what a tap in the middle would hit');
	await page.screenshot({ path: path.join(OUT, 'verify-title.png') });

	await page.touchscreen.tap(195, 422);
	const reached = await waitFor(async () => stages.includes('menu'), 240000);
	check(reached, 'a tap on the title card reaches the menu');
	await page.screenshot({ path: path.join(OUT, 'verify-menu.png') });
	await page.context().close();
}

async function testBrokenBuildReportsItself(browser) {
	console.log('\na build whose engine cannot load');
	const { page } = await newPage(browser, {});
	// The engine's own payload never arrives — the exact shape of "sits on the
	// loading screen forever" that had no diagnostic at all.
	await page.route('**/*.wasm', (route) => route.abort('failed'));
	await page.goto(BASE, { waitUntil: 'load', timeout: 180000 });

	const reported = await waitFor(() => page.evaluate(() => {
		const notice = document.getElementById('status-notice');
		return notice !== null && notice.style.display === 'block'
			&& notice.textContent.indexOf('build ') !== -1;
	}), 120000, 2000);
	check(reported, 'the loading screen reports the failure instead of hanging');

	const reload = await page.evaluate(() => {
		const button = document.getElementById('reload');
		return button !== null && button.style.display === 'block';
	});
	check(reload, 'a reload button is offered');
	await page.screenshot({ path: path.join(OUT, 'verify-failure.png') });
	await page.context().close();
}

(async () => {
	if (!BASE) {
		console.error('usage: node tools/verify-web.js <url> [outdir]');
		process.exit(2);
	}
	const browser = await chromium.launch({
		executablePath: EXECUTABLE,
		args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
	});
	await testTouchStartsTheGame(browser);
	await testBrokenBuildReportsItself(browser);
	await browser.close();

	console.log('\n' + (failures === 0 ? 'all checks passed' : failures + ' check(s) failed'));
	process.exit(failures === 0 ? 0 : 1);
})();
