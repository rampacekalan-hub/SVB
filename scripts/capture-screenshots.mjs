/**
 * DomovPlus — Marketing screenshots cez Playwright.
 *
 * Spustí headless Chromium, prihlási sa ako demo predseda, pozbiera screenshoty
 * jednotlivých sekcií appky a uloží ich do apps/web/public/screenshots/.
 *
 * Použitie:
 *   1. Skontrolujte že beží:
 *        - API na :3100
 *        - Web na :5174
 *        - DB seedovaná (predseda@domovplus.local / DemoHeslo12345!)
 *   2. node scripts/capture-screenshots.mjs
 *
 * Výsledok: public/screenshots/{name}.png — použiteľné z marketing stránky.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'apps', 'web', 'public', 'screenshots');
mkdirSync(OUT_DIR, { recursive: true });

const WEB_URL = process.env.WEB_URL || 'http://localhost:5174';
const EMAIL = process.env.DEMO_EMAIL || 'predseda@domovplus.local';
const PASSWORD = process.env.DEMO_PASSWORD || 'DemoHeslo12345!';

console.log(`📸 DomovPlus screenshot capture`);
console.log(`   Web: ${WEB_URL}`);
console.log(`   Out: ${OUT_DIR}`);

const browser = await chromium.launch({ headless: true });

// ──────────────────────────────────────────────────────────
// Desktop screenshots — prihlásený ako predseda
// ──────────────────────────────────────────────────────────
const desktop = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'sk-SK',
});
const page = await desktop.newPage();

// 1. Login
console.log('→ Prihlásenie ako predseda…');
await page.goto(`${WEB_URL}/prihlasenie`, { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle');

// Po loginu by mal app redirektovať na /b/:id alebo na onboarding.
await page.waitForFunction(() => !location.pathname.startsWith('/prihlasenie'), { timeout: 10000 });
let afterLoginUrl = page.url();
console.log(`   ✓ prihlásený, URL = ${afterLoginUrl}`);

// Ak appka redirektovala na /admin (Manager shell) — klikneme na prvú budovu
let buildingId = afterLoginUrl.match(/\/b\/([^/?#]+)/)?.[1];
if (!buildingId && afterLoginUrl.includes('/admin')) {
  console.log('   → som na /admin, hľadám prvú budovu…');
  await page.goto(`${WEB_URL}/admin/budovy`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // klik na prvý <a href="/b/...">
  const firstBuildingLink = await page.locator('a[href^="/b/"]').first();
  if (await firstBuildingLink.count() > 0) {
    await firstBuildingLink.click();
    await page.waitForLoadState('networkidle');
    afterLoginUrl = page.url();
    buildingId = afterLoginUrl.match(/\/b\/([^/?#]+)/)?.[1];
    console.log(`   ✓ navigoval som na budovu ${buildingId}`);
  }
}

// Helper: screenshot s waitom na content
async function shoot(name, path, opts = {}) {
  console.log(`→ ${name}: ${path}`);
  await page.goto(`${WEB_URL}${path}`, { waitUntil: 'networkidle' });
  // Doplnkový čas na dokončenie animácií
  await page.waitForTimeout(opts.wait || 800);
  // Skry mobile dock ak je viditeľný (na desktope by nemal byť, ale poistka)
  await page.evaluate(() => {
    document.querySelectorAll('.mobile-dock, .ui-dock').forEach((el) => (el).style.display = 'none');
  });
  await page.screenshot({
    path: join(OUT_DIR, `${name}.png`),
    fullPage: opts.fullPage || false,
    clip: opts.clip,
  });
}

// 2. Chairman dashboard
if (buildingId) {
  await shoot('chairman-dashboard', `/b/${buildingId}`, { fullPage: false });
  await shoot('chairman-voting', `/b/${buildingId}/hlasovania`, { fullPage: false });
  await shoot('chairman-tickets', `/b/${buildingId}/poruchy`, { fullPage: false });
  await shoot('chairman-payments', `/b/${buildingId}/platby`, { fullPage: false });
  await shoot('chairman-meetings', `/b/${buildingId}/schodze`, { fullPage: false });
  await shoot('chairman-revisions', `/b/${buildingId}/revizie`, { fullPage: false });
  await shoot('chairman-documents', `/b/${buildingId}/dokumenty`, { fullPage: false });
  await shoot('chairman-audit', `/b/${buildingId}/audit`, { fullPage: false });
} else {
  console.warn('⚠ buildingId nenájdený v URL — preskakujem chairman screenshots');
}

await desktop.close();

// ──────────────────────────────────────────────────────────
// Mobile screenshots — resident view
// ──────────────────────────────────────────────────────────
console.log('\n📱 Mobile resident screenshots…');
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 14 Pro
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'sk-SK',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const mpage = await mobile.newPage();

// Try resident login (separate seed account if exists, otherwise reuse predseda)
const RESIDENT_EMAIL = process.env.RESIDENT_EMAIL || 'vlastnik@domovplus.local';
const RESIDENT_PASSWORD = process.env.RESIDENT_PASSWORD || 'DemoHeslo12345!';

async function tryLogin(email, password) {
  // Fresh page for each attempt to avoid stale state
  const fresh = await mobile.newPage();
  try {
    await fresh.goto(`${WEB_URL}/prihlasenie`, { waitUntil: 'domcontentloaded' });
    await fresh.fill('input[type="email"]', email);
    await fresh.fill('input[type="password"]', password);
    await Promise.all([
      fresh.waitForURL((url) => !url.toString().includes('/prihlasenie'), { timeout: 8000 }).catch(() => null),
      fresh.click('button[type="submit"]'),
    ]);
    await fresh.waitForLoadState('networkidle').catch(() => {});
    const ok = !fresh.url().includes('/prihlasenie');
    return ok ? fresh : (await fresh.close(), null);
  } catch {
    await fresh.close().catch(() => {});
    return null;
  }
}

let activeMpage = await tryLogin(RESIDENT_EMAIL, RESIDENT_PASSWORD);
if (!activeMpage) {
  console.log('   ⚠ resident login zlyhal, skúšam predsedu');
  activeMpage = await tryLogin(EMAIL, PASSWORD);
}
if (!activeMpage) {
  console.warn('   ✗ mobile login zlyhal úplne, končím (desktop screenshoty máme)');
  await mobile.close();
  await browser.close();
  process.exit(0);
}
// Replace shared mpage variable
await mpage.close();
const realMpage = activeMpage;

async function shootMobile(name, path) {
  console.log(`→ mobile-${name}: ${path}`);
  await realMpage.goto(`${WEB_URL}${path}`, { waitUntil: 'networkidle' });
  await realMpage.waitForTimeout(800);
  await realMpage.screenshot({
    path: join(OUT_DIR, `mobile-${name}.png`),
    fullPage: false,
  });
}

// Resident routes
await shootMobile('home', '/moj-dom/domov').catch(() => console.warn('   skip mobile-home'));
await shootMobile('faktury', '/moj-dom/faktury').catch(() => console.warn('   skip mobile-faktury'));
await shootMobile('schodze', '/moj-dom/schodze').catch(() => console.warn('   skip mobile-schodze'));
await shootMobile('burza', '/moj-dom/burza').catch(() => console.warn('   skip mobile-burza'));

await mobile.close();
await browser.close();

console.log(`\n✅ Hotovo. Screenshoty v ${OUT_DIR}`);
