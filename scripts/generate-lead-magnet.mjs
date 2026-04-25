/**
 * Lead magnet generator — PDF "Checklist prvej elektronickej schôdze SVB".
 *
 * 6 strán A4. Statický obsah, generovaný raz pri builde.
 * Output: apps/web/public/checklist-prvej-elektronickej-schodze.pdf
 *
 * Spustenie:  node scripts/generate-lead-magnet.mjs
 */
import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'apps', 'web', 'public', 'checklist-prvej-elektronickej-schodze.pdf');
mkdirSync(dirname(OUT_PATH), { recursive: true });

const TEAL = '#0f766e';
const TEAL_SOFT = '#ccfbf1';
const FG = '#0f172a';
const MUTED = '#64748b';

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  info: {
    Title: 'Checklist prvej elektronickej schôdze SVB',
    Author: 'DomovPlus',
    Subject: 'Návod pre predsedov SVB / BD na zavedenie elektronického hlasovania',
  },
});
doc.pipe(createWriteStream(OUT_PATH));

// ──────────────────────────────────────────
// COVER PAGE
// ──────────────────────────────────────────
doc.rect(0, 0, doc.page.width, 200).fill(TEAL);
doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
  .text('DOMOVPLUS  ·  CHECKLIST PRE PREDSEDOV', 60, 60, { characterSpacing: 1 });

doc.fontSize(28).font('Helvetica-Bold')
  .text('Prvá elektronická\nschôdza SVB / BD', 60, 100, { lineGap: 4 });

doc.fillColor(FG).fontSize(13).font('Helvetica').moveDown(8)
  .text('6-stranový návod s konkrétnymi krokmi, vzormi zápisnice a právnym výkladom §14 ods. 5 zákona č. 182/1993 Z. z.', 60, 240, {
    width: doc.page.width - 120,
    lineGap: 2,
  });

doc.moveDown(2);
doc.fontSize(10).fillColor(MUTED)
  .text('Aktualizované 2026  ·  Pre Slovenskú a Českú republiku  ·  Vydáva DomovPlus', { lineGap: 2 });

// Veľký checklist preview
doc.moveDown(3);
const previewY = doc.y;
doc.roundedRect(60, previewY, doc.page.width - 120, 220, 12).fillAndStroke('#f8fafc', '#e2e8f0');
doc.fillColor(FG).fontSize(13).font('Helvetica-Bold').text('Čo nájdete vnútri', 80, previewY + 20);
doc.fontSize(11).font('Helvetica').fillColor(MUTED);
const items = [
  '✓  Právny rámec — §14 ods. 5 zákona č. 182/1993 Z. z., §1206 NOZ pre ČR',
  '✓  Vzor uznesenia o zavedení elektronického hlasovania',
  '✓  Checklist prípravy schôdze (program, pozvánky, RSVP)',
  '✓  Postup pre vlastníkov bez smartfónu (listinný hlas)',
  '✓  Vzor zápisnice s elektronickými + papierovými hlasmi',
  '✓  Časté chyby a ako sa im vyhnúť',
];
items.forEach((it, i) => {
  doc.text(it, 80, previewY + 50 + i * 24, { width: doc.page.width - 160 });
});

// Strana 2 – Právny rámec
doc.addPage();
sectionTitle('1. Právny rámec', '§14 ods. 5 zákona č. 182/1993 Z. z. + §1206 NOZ');

para(
  'Slovenská aj česká legislatíva už od roku 2018 explicitne povoľuje elektronické hlasovanie vlastníkov bytov, ' +
  'pokiaľ o ňom rozhodne schôdza vlastníkov nadpolovičnou väčšinou hlasov. Elektronické hlasovanie tak má rovnakú právnu silu ako papierové.'
);

bullet([
  'Schôdza vlastníkov musí najprv prijať uznesenie, ktoré zavádza elektronické hlasovanie ako prípustnú formu — vzor uznesenia je v sekcii 2.',
  'Prijaté uznesenie musí byť zapísané v zápisnici a podpísané predsedom + dvomi overovateľmi.',
  'Listinný (papierový) hlas má vždy prednosť — ak vlastník hlasoval elektronicky aj papierovo, počíta sa papierový.',
  'Hlasovanie musí byť overiteľné: každý hlas potrebuje časový otlačok a overenie identity hlasujúceho.',
]);

calloutBox(
  '⚖️ DÔLEŽITÉ',
  'Bez explicitného uznesenia schôdze nie je elektronické hlasovanie právne validné. Najprv schvaľujeme metódu, potom hlasujeme cez ňu.'
);

// Strana 3 – Vzor uznesenia
doc.addPage();
sectionTitle('2. Vzor uznesenia', 'Prečítajte na schôdzi a dajte hlasovať');

para(
  'Tento text môžete použiť doslovne alebo upraviť podľa potrieb vašej budovy. Odporúčame ho preložiť do programu schôdze ' +
  'ešte pred jej termínom (stačí v programe uviesť „Bod č. X — schválenie elektronického hlasovania").'
);

doc.moveDown(0.5);
quoteBlock(
  'Schôdza vlastníkov bytov a nebytových priestorov v dome [adresa, súpisné číslo] svojím uznesením prijatým nadpolovičnou ' +
  'väčšinou hlasov všetkých vlastníkov\n\nrozhoduje\n\no zavedení elektronického hlasovania prostredníctvom platformy DomovPlus ' +
  '(domovplus.sk) ako rovnocenného spôsobu hlasovania popri listinnom hlasovaní.\n\n' +
  'Listinný hlas má pri kolízii prednosť pred elektronickým. Predseda spoločenstva je poverený zriadením elektronickej ' +
  'evidencie vlastníkov a vystavením aktivačných kódov.'
);

doc.moveDown(0.5);
para('Pri hlasovaní zaznamenajte:');
bullet([
  'Počet všetkých vlastníkov a ich spoluvlastnícke podiely',
  'Počet hlasov ZA / PROTI / ZDRŽAL SA',
  'Výsledok (prijaté / neprijaté) a dátum nadobudnutia účinnosti',
]);

// Strana 4 – Checklist prípravy
doc.addPage();
sectionTitle('3. Checklist prípravy schôdze', 'Pre prvú elektronickú schôdzu odporúčame 4 týždne');

const weeks = [
  {
    t: '4 týždne pred',
    items: [
      'Pripraviť program schôdze (PDF)',
      'Vytvoriť budovu v DomovPlus + importovať byty z Excelu',
      'Vygenerovať aktivačné kódy pre vlastníkov (PDF na vytlačenie do schránok)',
    ],
  },
  {
    t: '3 týždne pred',
    items: [
      'Distribuovať aktivačné kódy do schránok + email + SMS',
      'Otvoriť RSVP — vlastníci potvrdia účasť cez appku alebo telefón predsedovi',
      'Pripraviť listinné hlasovacie lístky pre vlastníkov, ktorí preferujú papier',
    ],
  },
  {
    t: '1 týždeň pred',
    items: [
      'Pripomienka pre tých, ktorí sa ešte nezaregistrovali (predseda v appke uvidí stav)',
      'Otestovať hlasovanie na 1 nesporném bode (napr. „Schvaľujeme zápisnicu z minulej schôdze")',
      'Pripraviť overovateľov a zapisovateľa',
    ],
  },
  {
    t: 'Deň schôdze',
    items: [
      'Prijať uznesenie o elektronickom hlasovaní (ak ešte nie je platné)',
      'Otvoriť hlavné hlasovanie cez DomovPlus počas schôdze (uzávierka napr. o 7 dní)',
      'Vlastníci hlasujú cez mobil priamo na schôdzi alebo do uzávierky',
      'Listinné hlasovacie lístky predseda zapisuje do appky',
    ],
  },
  {
    t: 'Po uzávierke',
    items: [
      'Systém automaticky vygeneruje zápisnicu s XAdES-BES podpisom (PDF)',
      'Predseda + dvaja overovatelia podpíšu zápisnicu',
      'Distribuovať zápisnicu vlastníkom (push + email + tlač do schránok)',
    ],
  },
];
weeks.forEach((w) => {
  doc.fillColor(TEAL).fontSize(12).font('Helvetica-Bold').text(w.t);
  doc.fillColor(FG).fontSize(11).font('Helvetica');
  w.items.forEach((it) => {
    doc.text('☐  ' + it, { indent: 12, lineGap: 2 });
  });
  doc.moveDown(0.6);
});

// Strana 5 – Vlastníci bez smartfónu
doc.addPage();
sectionTitle('4. Vlastníci bez smartfónu', 'Najčastejšia obava predsedov — riešenie je jednoduché');

para(
  'Elektronické hlasovanie nemusí znamenať, že každý musí mať smartfón. Zákon explicitne povoľuje listinný (papierový) hlas ' +
  'ako rovnocennú alternatívu — má dokonca prednosť pri kolízii.'
);

bullet([
  'Vlastník bez prístupu k internetu odovzdá vyplnený lístok predsedovi alebo zapisovateľovi',
  'Predseda zapíše papierový hlas do DomovPlus pred uzávierkou (vlastná funkcia „Listinný hlas")',
  'Systém automaticky uprednostní listinný pred elektronickým — bez ohľadu na poradie zaznamenania',
  'Zápisnica obsahuje samostatnú sekciu pre papierové hlasy aj s podpismi',
]);

calloutBox(
  '👵 PRAKTICKÝ TIP',
  'Pri prvej elektronickej schôdzi obvykle ~70 % vlastníkov hlasuje elektronicky a ~30 % papierovo. Po druhej alebo tretej schôdzi sa pomer otočí na 90 / 10. Generačná zmena prebieha rýchlo, ak je systém dobre zavedený.'
);

para(' ', 8);
sectionTitle('5. Časté chyby', 'Čomu sa pri prvej elektronickej schôdzi vyhnúť');

bullet([
  '✗ Otvoriť hlasovanie bez prijatého uznesenia o elektronickej forme — výsledok je napadnuteľný',
  '✗ Krátka uzávierka (menej ako 7 dní) — niektorí vlastníci sú na dovolenke a nestihnú',
  '✗ Žiadna pripomienka pred uzávierkou — register málo aktívnych vlastníkov',
  '✗ Bezpečnostné kódy posielané v Vibere — riziko zdieľania, použite radšej tlač do schránok',
  '✗ Neskoré informovanie o výsledku — zápisnicu rozposielajte do 24 h od uzávierky',
]);

// Strana 6 – Kontakt + výzva
doc.addPage();
doc.rect(0, 0, doc.page.width, 200).fill(TEAL);
doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
  .text('Pomôžeme vám\nso zavedením', 60, 80);
doc.fontSize(13).font('Helvetica').moveDown(0.5)
  .text('Pilot partneri majú prvý rok zdarma.\nOsobne prídeme, nasetujeme a školíme výbor.', { lineGap: 4 });

doc.fillColor(FG).fontSize(12).font('Helvetica');
const contactY = 240;
doc.fontSize(11).font('Helvetica-Bold').fillColor(TEAL).text('KONTAKT', 60, contactY);
doc.fillColor(FG).fontSize(13).font('Helvetica').text('hello@domovplus.sk', 60, contactY + 20);
doc.text('+421 911 000 000', 60, contactY + 42);

doc.fontSize(11).font('Helvetica-Bold').fillColor(TEAL).text('WEB', 60, contactY + 80);
doc.fillColor(FG).fontSize(13).font('Helvetica').text('https://domovplus.sk', 60, contactY + 100);

doc.fontSize(11).font('Helvetica-Bold').fillColor(TEAL).text('PRACOVNÝ ČAS', 60, contactY + 140);
doc.fillColor(FG).fontSize(13).font('Helvetica').text('Po–Pi · 9:00 – 17:00 · odpoveď do 24 h', 60, contactY + 160);

// CTA box dolu
const boxY = doc.page.height - 220;
doc.roundedRect(60, boxY, doc.page.width - 120, 140, 12).fill(TEAL_SOFT);
doc.fillColor(TEAL).fontSize(14).font('Helvetica-Bold')
  .text('🎮 Vyskúšajte demo bez registrácie', 80, boxY + 24);
doc.fillColor(FG).fontSize(11).font('Helvetica')
  .text('Predvyplnená budova s 12 bytmi, hlasovaniami, faktúrami. Žiadny účet, hneď použiteľné.\n\nNa domovplus.sk kliknite "Vyskúšať demo".', 80, boxY + 50, { width: doc.page.width - 160, lineGap: 3 });

doc.fillColor(MUTED).fontSize(9).text(
  '© 2026 DomovPlus — Operačný systém pre bytový dom · SR / ČR · Self-hosted, GDPR-compliant',
  60, doc.page.height - 50,
  { width: doc.page.width - 120, align: 'center' },
);

doc.end();

// Helper functions
function sectionTitle(num, sub) {
  doc.fillColor(TEAL).fontSize(20).font('Helvetica-Bold').text(num);
  doc.fillColor(MUTED).fontSize(11).font('Helvetica').text(sub);
  doc.fillColor(FG).moveDown(1);
}
function para(text, size = 11) {
  doc.fillColor(FG).fontSize(size).font('Helvetica').text(text, { lineGap: 3 });
  doc.moveDown(0.6);
}
function bullet(items) {
  doc.fillColor(FG).fontSize(11).font('Helvetica');
  items.forEach((it) => {
    doc.text('•  ' + it, { indent: 12, lineGap: 3, paragraphGap: 4 });
  });
  doc.moveDown(0.6);
}
function calloutBox(label, text) {
  const y = doc.y;
  doc.roundedRect(60, y, doc.page.width - 120, 70, 8).fill(TEAL_SOFT);
  doc.fillColor(TEAL).fontSize(9).font('Helvetica-Bold').text(label, 80, y + 14, { characterSpacing: 1 });
  doc.fillColor(FG).fontSize(10).font('Helvetica').text(text, 80, y + 30, { width: doc.page.width - 160, lineGap: 2 });
  doc.y = y + 80;
  doc.moveDown(0.4);
}
function quoteBlock(text) {
  const y = doc.y;
  const h = 170;
  doc.rect(60, y, 4, h).fill(TEAL);
  doc.fillColor(FG).fontSize(11).font('Helvetica-Oblique')
    .text(text, 80, y + 8, { width: doc.page.width - 140, lineGap: 4 });
  doc.y = y + h;
  doc.moveDown(0.5);
  doc.font('Helvetica');
}

console.log(`✅ Lead magnet PDF: ${OUT_PATH}`);
