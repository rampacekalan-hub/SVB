/**
 * OG image generator — vytvorí 1200×630 obrázok pre social media share preview.
 * Uloží do apps/web/public/og-image.png + og-image.jpg (fallback).
 *
 * Spustenie:  node scripts/generate-og-image.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'apps', 'web', 'public');
mkdirSync(OUT_DIR, { recursive: true });

const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background:
      radial-gradient(800px 400px at 15% 25%, #ccfbf1 0%, transparent 60%),
      radial-gradient(600px 400px at 85% 75%, #fef3c7 0%, transparent 55%),
      #fafaf9;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #0f172a;
    overflow: hidden;
    position: relative;
  }
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(15, 118, 110, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(15, 118, 110, 0.06) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
    opacity: 0.5;
  }
  .frame {
    position: relative;
    padding: 80px 90px;
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 60px;
    height: 100%;
    align-items: center;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 18px;
    border: 1px solid rgba(15, 118, 110, 0.25);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.8);
    font-size: 16px;
    font-weight: 600;
    color: #475569;
    backdrop-filter: blur(8px);
  }
  .badge-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #14b8a6;
    box-shadow: 0 0 12px #14b8a6;
  }
  .h1 {
    font-size: 72px;
    font-weight: 800;
    line-height: 1.02;
    letter-spacing: -0.035em;
    margin: 24px 0 20px;
    color: #0f172a;
  }
  .accent {
    background: linear-gradient(135deg, #0f766e 0%, #14b8a6 50%, #2dd4bf 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .lead {
    font-size: 22px;
    color: #475569;
    line-height: 1.45;
    max-width: 540px;
  }
  .footer {
    margin-top: 40px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .logo {
    width: 56px; height: 56px;
    border-radius: 14px;
    background: linear-gradient(135deg, #0f766e, #14b8a6);
    display: grid; place-items: center;
    color: white;
    box-shadow: 0 12px 28px -8px rgba(20, 184, 166, 0.45);
  }
  .brand {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .url {
    margin-left: auto;
    font-size: 18px;
    color: #64748b;
    font-family: ui-monospace, monospace;
  }

  /* Mockup right */
  .mockup {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
      0 40px 80px -20px rgba(15, 23, 42, 0.25),
      0 16px 32px -16px rgba(15, 118, 110, 0.18);
    transform: perspective(1500px) rotateY(-4deg) rotateX(2deg);
  }
  .mockup-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
    background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
  }
  .mockup-dot { width: 12px; height: 12px; border-radius: 50%; }
  .mockup-url {
    margin-left: 16px;
    font-size: 13px;
    color: #64748b;
    font-family: ui-monospace, monospace;
  }
  .mockup-body { padding: 22px; display: flex; flex-direction: column; gap: 14px; }
  .mockup-greet { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
  .mockup-sub { font-size: 14px; color: #64748b; margin-top: 2px; }
  .mockup-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 6px; }
  .kpi {
    padding: 12px;
    border-radius: 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }
  .kpi-l { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.06em; }
  .kpi-v { font-size: 18px; font-weight: 800; margin-top: 2px; letter-spacing: -0.02em; }
  .kpi-r .kpi-v { color: #dc2626; }
  .kpi-o .kpi-v { color: #c2410c; }
  .kpi-g .kpi-v { color: #059669; }

  .alert {
    padding: 14px 16px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-left: 3px solid #dc2626;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .alert-ic { font-size: 22px; }
  .alert-t { font-size: 14px; font-weight: 700; color: #0f172a; }
  .alert-s { font-size: 12px; color: #64748b; margin-top: 2px; }
  .alert-chip {
    margin-left: auto;
    font-size: 10px;
    font-weight: 800;
    background: #fee2e2;
    color: #991b1b;
    padding: 3px 8px;
    border-radius: 999px;
    letter-spacing: 0.06em;
  }
</style>
</head>
<body>
<div class="grid"></div>
<div class="frame">
  <div>
    <span class="badge"><span class="badge-dot"></span>Pre predsedov SVB · BD · SVJ</span>
    <h1 class="h1">Bytový dom <span class="accent">bez papierov</span>.</h1>
    <p class="lead">
      Vlastníci hlasujú z mobilu. Zápisnica za 3 dni. Faktúry s QR kódom.
      Self-hosted, GDPR-compliant.
    </p>
    <div class="footer">
      <div class="logo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" stroke="white" stroke-width="2" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="brand">DomovPlus</div>
      <div class="url">domovplus.sk</div>
    </div>
  </div>

  <div class="mockup">
    <div class="mockup-bar">
      <span class="mockup-dot" style="background:#fc6058"></span>
      <span class="mockup-dot" style="background:#fed84b"></span>
      <span class="mockup-dot" style="background:#36cd4d"></span>
      <span class="mockup-url">domovplus.sk/b/hviezdoslavova-12</span>
    </div>
    <div class="mockup-body">
      <div>
        <div class="mockup-greet">Dobré ráno, Jana.</div>
        <div class="mockup-sub">2 veci čakajú na rozhodnutie.</div>
      </div>
      <div class="mockup-kpis">
        <div class="kpi kpi-r"><div class="kpi-l">NEDOPLATKY</div><div class="kpi-v">169,50 €</div></div>
        <div class="kpi kpi-o"><div class="kpi-l">TIKETY</div><div class="kpi-v">2</div></div>
        <div class="kpi kpi-g"><div class="kpi-l">REVÍZIE</div><div class="kpi-v">1</div></div>
      </div>
      <div class="alert">
        <div class="alert-ic">🔧</div>
        <div>
          <div class="alert-t">Výtok vody v pivnici</div>
          <div class="alert-s">pred 2 h · byt 03</div>
        </div>
        <div class="alert-chip">URGENT</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>
`;

console.log('🎨 Generujem OG image (1200×630)…');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

await page.screenshot({
  path: join(OUT_DIR, 'og-image.png'),
  type: 'png',
  fullPage: false,
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});

await page.screenshot({
  path: join(OUT_DIR, 'og-image.jpg'),
  type: 'jpeg',
  quality: 88,
  fullPage: false,
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});

await browser.close();
console.log(`✅ OG image: ${join(OUT_DIR, 'og-image.png')}`);
console.log(`✅ OG image (JPG fallback): ${join(OUT_DIR, 'og-image.jpg')}`);
