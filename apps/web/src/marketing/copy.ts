/**
 * Marketing copy — SK texty pre landing stránku.
 *
 * Použitie:
 *   const c = useMarketingCopy();
 *   c.hero.h1Pre  → reťazec
 *
 * CZ verzia: keď bude pripravená, vznikne ako samostatná stránka /cz s vlastným copy.
 * Hook teda zatiaľ vždy vracia SK (žiaden jazykový prepínač v UI).
 */

interface MarketingCopy {
  hero: {
    eyebrow: string;
    h1Pre: string;
    h1Accent: string;
    h1Post: string;
    lead: string;
    ctaDemo: string;
    ctaDemoBusy: string;
    ctaFree: string;
    trust: string;
    trustAlt: string;
  };
  pilot: {
    badge: string;
    text: { strong: string; rest: string };
    cta: string;
  };
  features: {
    kicker: string;
    title: string;
    subtitle: string;
    items: { t: string; b: string }[];
  };
  beforeAfter: {
    kicker: string;
    title: string;
    subtitle: string;
    headers: { area: string; before: string; after: string };
    summary: { num: string; label: string }[];
    rows: { area: string; before: string; after: string }[];
  };
  showcase: {
    kicker: string;
    title: string;
    subtitle: string;
  };
  how: {
    kicker: string;
    title: string;
    subtitle: string;
    steps: { n: string; t: string; b: string }[];
  };
  pricing: {
    kicker: string;
    title: string;
    subtitle: string;
    note: string;
    plans: {
      tag: string; price: string; unit: string; desc: string;
      bullets: string[]; cta: string;
    }[];
    calc: {
      trigger: string;
      triggerSub: string;
      pill: string;
      h: string;
      sub: string;
      units: string;
      monthly: string;
      yearly: string;
      perUnit: string;
      contextHtml: (units: number, yearly: number, perUnitMonthly: number) => string;
      ctaFree: string;
      ctaCall: string;
      close: string;
    };
  };
  faq: {
    kicker: string;
    title: string;
    subtitle: string;
    showMore: (n: number) => string;
    items: { q: string; a: string }[];
  };
  leadMagnet: {
    pill: string;
    h1: string;
    h2: string;
    body: string;
    bullets: string[];
    placeholder: string;
    submit: string;
    submitting: string;
    thanksTitle: string;
    thanksBody: string;
    thanksLink: string;
    trust: string;
    pdfBand: string;
    pdfTitle: string;
    pdfPages: string;
  };
  quote: {
    blockquote: string;
    name: string;
    sub: string;
  };
  demoCall: {
    badge: string;
    h: string;
    body: string;
    bullets: string[];
    hours: string;
  };
  finalCta: {
    h1: string;
    h2: string;
    sub: string;
    placeholderEmail: string;
    placeholderCity: string;
    placeholderUnits: string;
    submit: string;
    submitting: string;
    thanksTitle: string;
    thanksBody: (email: string) => string;
    alt: string;
    altLink: string;
  };
  footer: {
    tagline: string;
    badges: string[];
    cols: { title: string; links: { label: string; href: string }[] }[];
    legal: string;
    legalLinks: { terms: string; privacy: string; dpa: string };
    made: string;
  };
}

const SK: MarketingCopy = {
  hero: {
    eyebrow: 'Pre predsedov SVB · BD · SVJ',
    h1Pre: 'Ušetrite ',
    h1Accent: '40 hodín ročne',
    h1Post: ' na správe domu.',
    lead:
      'Vlastníci hlasujú z mobilu. Zápisnica je hotová do troch dní namiesto dvoch mesiacov. ' +
      'Faktúra obsahuje SEPA QR kód, takže každý vlastník zaplatí jediným naskenovaním v mobilnej banke.',
    ctaDemo: '🎮 Vyskúšať demo bez registrácie',
    ctaDemoBusy: 'Otváram demo…',
    ctaFree: 'Začať zdarma na 30 dní',
    trust: 'Demo má pred-vyplnenú budovu · žiadna registrácia · 30 dní zdarma plný účet',
    trustAlt: '📞 Radšej si zavoláme cez Zoom →',
  },
  pilot: {
    badge: 'V pilote · 2026',
    text: {
      strong: 'Hľadáme prvé 3 SVB / BD v SR a ČR.',
      rest: ' Prvý rok zdarma, prenos dát zo Zošita / Excelu urobíme za vás. Osobne prídeme, nasetujeme a zaškolíme výbor.',
    },
    cta: 'Chcem byť pilot →',
  },
  features: {
    kicker: 'Funkcie',
    title: 'Všetko, čo bytový dom potrebuje',
    subtitle: 'Bez siedmich aplikácií. Bez Google tabuliek. Bez papierových oznamov na nástenke.',
    items: [
      { t: 'Hlasovanie', b: 'Vlastníci hlasujú z mobilu. Zápisnica s XAdES podpisom je hotová do troch dní.' },
      { t: 'Faktúry s QR', b: 'Vlastník naskenuje SEPA QR kód a banka mu predvyplní prevod. Úhrady sa spárujú importom CSV výpisu z banky.' },
      { t: 'Poruchy', b: 'Fotka a popis priamo z mobilu. Správca dostane push notifikáciu okamžite. Rýchlejšia reakcia znižuje škody.' },
      { t: 'Schôdze', b: 'Program dopredu, RSVP, zápisnica v PDF s podpismi prítomných. 45 minút namiesto dvoch hodín.' },
      { t: 'Plán revízií', b: 'Kotol, výťah, bleskozvod. Automatická pripomienka 30 a 7 dní vopred. Žiadne pokuty za nevykonanú revíziu.' },
      { t: 'Audit log', b: 'Hash-chain SHA-256: každá zmena má časový otlačok, ktorý sa nedá prepísať.' },
      { t: 'Digitálna nástenka', b: 'Oznamy s push notifikáciou a týždenným email digestom. Koniec papierových oznamov a Viber skupín.' },
      { t: 'Evidencia spotrieb', b: 'Mesačné odpočty vody, tepla, elektriny spoločných priestorov. Grafy spotreby v čase.' },
      { t: 'Burza susedov', b: 'Predám / hľadám / zadarmo / balík suseda. Komunita medzi vlastníkmi v jednej aplikácii.' },
    ],
  },
  beforeAfter: {
    kicker: 'Pred a po',
    title: 'Ako to bolo doteraz vs. ako to bude',
    subtitle: 'Konkrétne situácie, ktoré pozná každý predseda. Po prechode na DomovPlus sa každá z nich zmení.',
    headers: { area: 'Oblasť', before: 'Dnes (Excel + papier)', after: 'S DomovPlus' },
    summary: [
      { num: '~40 h', label: 'úspora času predsedu / rok' },
      { num: '3 dni', label: 'zápisnica namiesto dvoch mesiacov' },
      { num: '0 €', label: 'pokút za prešvihnuté revízie' },
    ],
    rows: [
      { area: 'Hlasovanie vlastníkov', before: 'Papierové lístky, šesť týždňov zber po schránkach, ručné sčítanie, zápisnica do dvoch mesiacov.', after: 'Vlastníci hlasujú z mobilu, uzávierka aj 24 hodín, automatický výpočet kvóra, zápisnica s XAdES podpisom do troch dní.' },
      { area: 'Faktúry a platby', before: 'Tabuľka v Exceli, variabilný symbol napísaný rukou na rohu, vlastník stratí variabilný symbol, neplatiči.', after: 'SEPA QR na faktúre, banka predvyplní platbu, CSV import z banky spáruje úhrady automaticky.' },
      { area: 'Poruchy a údržba', before: 'Volanie predsedovi cez telefón, vlastník zabudne nahlásiť, údržbár sa to dozvie o týždeň.', after: 'Fotka a popis z mobilu, push notifikácia okamžite, kompletná história v tikete, viditeľný stav opravy pre vlastníka.' },
      { area: 'Schôdze', before: '90 minút, papierová prezenčná listina, zápisnica „pošlem ju neskôr", nikto nevie, čo sa rozhodlo.', after: '45 minút, digitálne RSVP dopredu, program v PDF, zápisnica s podpismi do 24 hodín.' },
      { area: 'Plán revízií', before: 'Excel s dátumami, predseda zabudne, pokuta 1 600 € za nevykonanú revíziu výťahu.', after: 'Cron pripomienka 30 a 7 dní vopred, email a push notifikácia, kompletná história protokolov v PDF.' },
      { area: 'Komunikácia', before: 'Oznamy na nástenke, Viber skupina, vlastníci bez smartfónu sa nedozvedia nič, štyri kanály paralelne.', after: 'Digitálna nástenka, týždenný email digest, push notifikácia, jeden zdroj pravdy.' },
      { area: 'Dokumenty', before: 'Šanón u predsedu doma, pri zmene predsedu sa stratí polovica, nikto nevie, kde je posledná zmluva.', after: 'Archív v šiestich kategóriách, SHA-256 integrita, odkazovateľné zo zápisnice, stiahnutie jedným kliknutím.' },
      { area: 'Audit a transparentnosť', before: 'Vlastník tvrdí, že hlasoval inak, predseda nemá ako dokázať opak, konflikt na schôdzi.', after: 'Hash-chain audit log SHA-256, každá zmena má časový otlačok, technicky nemožné prepísať históriu.' },
    ],
  },
  showcase: {
    kicker: 'Ako to vyzerá',
    title: 'Jedna aplikácia, tri pohľady',
    subtitle: 'Každá rola vidí presne to, čo potrebuje. Žiadne zbytočnosti.',
  },
  how: {
    kicker: 'Začiatok',
    title: 'Funkčný dom za 30 minút',
    subtitle: 'Bez demo hovorov, bez implementácie.',
    steps: [
      { n: '01', t: 'Vytvoríte účet', b: 'Ako predseda alebo správca. Bez kreditnej karty, bez telefonátu.' },
      { n: '02', t: 'Nahráte byty z Excelu', b: 'Systém vygeneruje aktivačné kódy pre vlastníkov.' },
      { n: '03', t: 'Vlastníci sa pripoja', b: 'Pošlete PDF, SMS alebo email. Do týždňa máte 80 % registrovaných.' },
    ],
  },
  pricing: {
    kicker: 'Cena',
    title: 'Jednoduchá, bez skrytých poplatkov',
    subtitle: 'Platí sa zo spoločného účtu SVB, nie z peňazí predsedu.',
    note: 'Bez DPH. Prvé tri budovy pre správcov — prenos dát zdarma.',
    plans: [
      { tag: 'Štart', price: '0 €', unit: '30 dní zdarma', desc: 'Pre vyskúšanie bez záväzku.', bullets: ['Plná funkcionalita', 'Bez kreditnej karty', '1 budova'], cta: 'Vyskúšať' },
      { tag: 'Štandard', price: '2,49 €', unit: '/ byt / mesiac', desc: 'Pre SVB a BD. Najčastejšia voľba.', bullets: ['Všetko z pilotu', 'XAdES podpis zápisníc', 'SEPA QR + bank CSV', 'Pripomienky revízií', 'Prioritná podpora do 4 h'], cta: 'Vybrať plán' },
      { tag: 'Profesionál', price: 'Na mieru', unit: '', desc: 'Pre správcovské firmy s 5 a viac budovami.', bullets: ['Dedikovaný server', 'SLA zmluva', 'Účtovné exporty'], cta: 'Konzultácia' },
    ],
    calc: {
      trigger: 'Vypočítať pre svoju budovu',
      triggerSub: 'Posuňte slider — uvidíte presnú mesačnú a ročnú cenu pre svoj počet bytov',
      pill: 'Kalkulačka',
      h: 'Koľko to bude stáť moju budovu?',
      sub: 'Posuňte slider podľa počtu bytov. Ceny bez DPH, plán Štandard.',
      units: 'Počet bytov',
      monthly: 'Mesačne',
      yearly: 'Ročne',
      perUnit: 'Na byt',
      contextHtml: (u, y, m) =>
        `<strong>Pre kontext:</strong> ${u}-bytovka platí ročne ${y.toFixed(0)} €. Jeden výjazd advokáta pri spornej schôdzi stojí približne 350 €. Pokuta za nevykonanú revíziu výťahu: až 1 600 €. Príspevok do fondu opráv typicky <strong>${m.toFixed(2)} € / byt / mesiac</strong> — to je 0,75 % bežných nákladov SVB.`,
      ctaFree: 'Začať zdarma na 30 dní →',
      ctaCall: 'Zavolajme si — vysvetlíme to',
      close: '✕ Zavrieť kalkulačku',
    },
  },
  faq: {
    kicker: 'Časté otázky',
    title: 'Čo sa pýtajú predsedovia ako prvé',
    subtitle: 'Úprimné odpovede na otázky, ktoré by nás samých hnevalo počúvať od predajcu.',
    showMore: (n) => `Zobraziť ďalších ${n} otázok ↓`,
    items: [
      { q: 'Čo ak sa stratia hlasy alebo dáta?', a: 'Každý hlas je zapísaný do hash-chain audit logu (SHA-256), ktorý sa nedá prepísať. Počas pilotu zálohujeme týždenne, po nasadení produkcie denne s 30-dňovou retenciou. Export do PDF a CSV je kedykoľvek dostupný. Ak by sme my zbankrotovali, vaše dáta si stiahnete jedným kliknutím a pracujete ďalej.' },
      { q: 'Je to v súlade so zákonom 182/1993 (SR)?', a: '§14 ods. 5 explicitne povoľuje elektronické hlasovanie, ak o ňom rozhodne schôdza vlastníkov. Ochrana pred duplicitami: listinný hlas má prednosť — ak vlastník hlasoval elektronicky aj papierovo, systém uprednostní papier. Pre ČR platí obdobne §1206 NOZ.' },
      { q: 'Kto vlastní naše dáta?', a: 'SVB / BD. My sme iba poskytovateľ softvéru. Dáta sú hostované v dátovom centre v EÚ. Môžete si ich kedykoľvek exportovať alebo spustiť celý systém na vlastnom serveri — sme open-source friendly.' },
      { q: 'Čo keď vypadne internet v dome?', a: 'Mobilná aplikácia uloží posledný stav — vlastník si pozrie naposledy načítané faktúry, hlasovania a oznamy aj offline (read-only). Akcie ako odoslanie hlasu alebo nahlásenie poruchy vyžadujú online pripojenie. Plný offline-write režim s neskoršou synchronizáciou je na roadmape pre Q3 2026.' },
      { q: 'Koľko to reálne stojí pri 24-bytovke?', a: '24 × 2,49 € = 59,76 € mesačne = 717,12 € ročne. To je menej ako jeden výjazd advokáta pri spornej schôdzi. Platí sa zo spoločného účtu SVB, nie z peňazí predsedu. Faktúra obsahuje všetky náležitosti pre účtovníčku.' },
      { q: 'Potrebujem technicky rozumieť, aby som to rozbehal?', a: 'Nie. Pre pilot partnerov prídeme osobne, nasetujeme, naimportujeme Excel s bytmi, vytlačíme a distribuujeme aktivačné kódy. Pre ostatných je to cez chat alebo videohovor. Nemusíte riešiť nič technické.' },
      { q: 'Môžem skončiť, ak sa mi to nebude páčiť?', a: 'Kedykoľvek. Žiadna výpovedná doba, žiadne sankcie. Zmluva končí kalendárnym mesiacom. Export všetkých dát do PDF a CSV je súčasťou — odchádzate s kompletným archívom vašej budovy.' },
      { q: 'Budete zajtra ešte existovať?', a: 'Úprimná odpoveď: toto je mladý projekt a máme pre prvé SVB špeciálnu záruku. Ak by sme v prvom roku zatvorili, dostanete plný refund, kompletný export a open-source kód aplikácie, aby ste si ju mohli spustiť na vlastnom serveri. Zero lock-in.' },
    ],
  },
  leadMagnet: {
    pill: '📘 Stiahnite zdarma',
    h1: 'Checklist prvej',
    h2: 'elektronickej schôdze SVB',
    body: '6-stranový PDF návod s konkrétnymi krokmi, vzormi zápisnice a právnym výkladom §14 ods. 5 zákona č. 182/1993 Z. z. a §1206 NOZ.',
    bullets: [
      'Vzor uznesenia, ktoré stačí prečítať na schôdzi',
      'Časový plán prípravy 4 týždne dopredu',
      'Postup pre vlastníkov bez smartfónu',
      '5 najčastejších chýb a ako sa im vyhnúť',
    ],
    placeholder: 'vas-email@svb.sk',
    submit: 'Stiahnuť PDF →',
    submitting: 'Pripravujem…',
    thanksTitle: 'Sťahuje sa.',
    thanksBody: 'Ak sa stiahnutie nespustilo, ',
    thanksLink: 'kliknite sem',
    trust: 'Žiadny spam. Email použijeme len ak by sme vám mali poslať aktualizáciu návodu (raz až dvakrát ročne).',
    pdfBand: 'DOMOVPLUS  ·  CHECKLIST',
    pdfTitle: 'Prvá elektronická schôdza SVB / BD',
    pdfPages: '6 strán  ·  PDF  ·  zdarma',
  },
  quote: {
    blockquote: 'Vlastník zo štvrtého poschodia si zaplatil faktúru sám cez QR. To je pre mňa najlepší dôkaz, že je to jednoduché.',
    name: 'Peter Vlastník',
    sub: 'byt 02, Bytový dom Hviezdoslavova 12',
  },
  demoCall: {
    badge: '30 minút · zdarma · bez záväzku',
    h: 'Radšej sa pozrieme spolu',
    body: 'Zavoláme si cez Zoom, ukážeme vám živú aplikáciu na vašej budove. Prejdeme si prvé hlasovanie, nastavíme faktúry a zodpovieme všetko, na čo ste zabudli spýtať sa.',
    bullets: [
      'Žiadna prezentácia — priamo do aplikácie',
      'Vezmite si 2 – 3 kolegov z výboru, aby ste sa mohli poradiť',
      'Po hovore dostanete záznam a cenovú ponuku',
    ],
    hours: 'Po – Pi · 9:00 – 17:00\nOdpovedáme do 24 hodín',
  },
  finalCta: {
    h1: 'Začnite ',
    h2: 'do 10 minút.',
    sub: 'Bez platobnej karty, 14-dňová záruka vrátenia peňazí.',
    placeholderEmail: 'predseda@vasa-svb.sk',
    placeholderCity: 'Mesto',
    placeholderUnits: 'Počet bytov',
    submit: 'Začať zdarma →',
    submitting: 'Odosielam…',
    thanksTitle: 'Ďakujeme!',
    thanksBody: (email) => `Ozveme sa do 24 hodín na ${email}.`,
    alt: 'Alebo ',
    altLink: 'vytvorte účet priamo',
  },
  footer: {
    tagline: 'Operačný systém pre bytový dom.\nSelf-hosted. Slovak / Czech compliance.',
    badges: ['SK 182/1993', 'CZ NOZ', 'GDPR'],
    cols: [
      { title: 'Produkt', links: [{ label: 'Funkcie', href: '#funkcie' }, { label: 'Ako funguje', href: '#how' }, { label: 'Cenník', href: '#cennik' }, { label: 'Registrácia', href: '/registracia' }] },
      { title: 'Pre koho', links: [{ label: 'Vlastníci (mám kód)', href: '/aktivacia' }, { label: 'Predsedovia SVB / BD', href: '/registracia' }, { label: 'Správcovské firmy', href: '/registracia' }] },
      { title: 'Podpora', links: [{ label: 'hello@domovplus.sk', href: 'mailto:hello@domovplus.sk' }, { label: '+421 911 000 000', href: 'tel:+421911000000' }, { label: 'Prihlásenie', href: '/prihlasenie' }] },
    ],
    legal: '© 2026 DomovPlus',
    legalLinks: { terms: 'Obchodné podmienky', privacy: 'Ochrana údajov', dpa: 'DPA' },
    made: 'Postavené v Bratislave',
  },
};


export function useMarketingCopy(): MarketingCopy {
  return SK;
}

