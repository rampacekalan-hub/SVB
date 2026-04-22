import { createContext, useContext } from 'react';

/**
 * Jednoduchý i18n — bez externej knižnice, zladený s User.locale.
 * Podporuje interpoláciu cez {{param}}.
 *
 * Stratégia: jedno centrálne slovníkové mapovanie, T komponent / useT hook.
 * Neznáme kľúče → vráti samotný kľúč (fail-soft, ľahko spozorovateľné).
 */

export type Locale = 'SK' | 'CS';

type Dict = Record<string, string>;

const sk: Dict = {
  'app.title': 'DomovPlus',
  'nav.logout': 'Odhlásiť',
  'nav.seniorOn': 'Väčšie písmo',
  'nav.seniorOff': 'Normálne',
  'nav.locale': 'Jazyk',
  'auth.welcome': 'Vitajte späť',
  'auth.subtitle': 'Prihláste sa do vášho bytového domu.',
  'auth.email': 'Email',
  'auth.password': 'Heslo',
  'auth.totp': 'Overovací kód (6 číslic)',
  'auth.submit': 'Prihlásiť sa',
  'auth.submitting': 'Prihlasujem…',
  'auth.invalid': 'Nesprávne prihlasovacie údaje. Skúste znova.',
  'auth.noAccount': 'Ste správca SVB / BD bez účtu?',
  'auth.createAdmin': 'Vytvoriť účet správcu',
  'auth.haveAccount': 'Máte už účet?',
  'auth.signIn': 'Prihlásiť sa',
  'admin.register.title': 'Vytvoriť účet správcu',
  'admin.register.subtitle': 'Založíme si účet. V ďalšom kroku vytvoríte prvú budovu a nahráte byty.',
  'admin.register.firstName': 'Meno',
  'admin.register.lastName': 'Priezvisko',
  'admin.register.password': 'Heslo (minimálne 10 znakov)',
  'admin.register.submit': 'Pokračovať',
  'admin.register.submitting': 'Vytváram účet…',
  'dashboard.greeting.morning': 'Dobré ráno',
  'dashboard.greeting.day': 'Dobrý deň',
  'dashboard.greeting.evening': 'Dobrý večer',
  'dashboard.chooseBuilding': 'Vyberte si budovu, ktorú chcete spravovať alebo si pozrieť.',
  'dashboard.yourBuildings': 'Vaše budovy',
  'dashboard.empty.title': 'Zatiaľ žiadna budova',
  'dashboard.empty.body': 'Požiadajte správcu o aktivačný kód z vyúčtovania.',
  'building.back': '← Späť',
  'building.title': 'Moja budova',
  'building.subtitle': 'Prehľad hlasovaní, oznamov, faktúr a schôdzí.',
  'votings.title': 'Hlasovania',
  'votings.empty.title': 'Žiadne aktívne hlasovanie',
  'votings.empty.body': 'Keď predseda vytvorí hlasovanie, zobrazí sa tu.',
  'announcements.title': 'Nástenka',
  'announcements.empty.title': 'Žiadne nové oznamy',
  'announcements.empty.body': 'Tu sa zobrazia informácie o odstávkach a udalostiach.',
  'tickets.title': 'Poruchy',
  'tickets.empty.title': 'Žiadne nahlásené poruchy',
  'tickets.empty.body': 'Všetko funguje. Ak niečo nie je v poriadku, môžete to nahlásiť v mobilnej aplikácii.',
  'invoices.title': 'Faktúry a vyúčtovania',
  'invoices.empty.title': 'Zatiaľ žiadne faktúry',
  'invoices.empty.body': 'Správca ich vystaví každý mesiac — zobrazia sa tu.',
  'invoices.showQr': 'Zaplatiť QR kódom',
  'invoices.qrHint': 'Naskenujte mobilnou bankou — prevod sa predvyplní.',
  'invoices.closeQr': 'Zatvoriť',
  'meetings.title': 'Schôdze vlastníkov',
  'meetings.empty.title': 'Žiadna plánovaná schôdza',
  'meetings.empty.body': 'Predseda tu zverejní termín a program.',
  'meetings.agenda': 'Program schôdze',
  'meetings.uploadMinutes': 'Nahrať zápisnicu (PDF)',
  'meetings.downloadMinutes': 'Stiahnuť zápisnicu',
  'balance.outstanding': 'Nedoplatok',
  'balance.noOutstanding': 'Bez nedoplatku',
  'balance.unpaidCount': '{{n}} neuhradených faktúr',
  'balance.allPaid': 'Všetky faktúry zaplatené',
  'balance.totalInvoices': 'Celkovo faktúr',
  'balance.totalInvoicesSub': 'Vrátane zaplatených',
  'admin.title': 'Správa budovy',
  'admin.uploadXlsx': 'Nahrať .xlsx',
  'admin.importing': 'Importujem…',
  'admin.template': 'Šablóna (.xlsx)',
  'admin.codesPdf': 'Aktivačné kódy (PDF)',
  'admin.bankImport': 'Import bankového výpisu (CSV)',
  'admin.importedCount': 'Vytvorených: {{n}}',
  'admin.skippedCount': 'Preskočené (existujú): {{n}}',
  'admin.errorsCount': 'Chyby: {{n}}',
  'admin.bankMatched': 'Priradené: {{n}}',
  'admin.bankUnmatched': 'Nepriradené: {{n}}',
  'admin.stats.apartments': 'Byty',
  'admin.stats.registered': 'Registrovaní vlastníci',
  'admin.stats.openTickets': 'Aktívne poruchy',
  'admin.stats.outstanding': 'Nedoplatky spolu',
  'wizard.step1': 'Registrácia',
  'wizard.step2': 'Budova',
  'wizard.step3': 'Byty',
  'wizard.step4': 'Hotovo',
};

const cs: Dict = {
  'app.title': 'DomovPlus',
  'nav.logout': 'Odhlásit',
  'nav.seniorOn': 'Větší písmo',
  'nav.seniorOff': 'Normální',
  'nav.locale': 'Jazyk',
  'auth.welcome': 'Vítejte zpět',
  'auth.subtitle': 'Přihlaste se do vašeho bytového domu.',
  'auth.email': 'E-mail',
  'auth.password': 'Heslo',
  'auth.totp': 'Ověřovací kód (6 číslic)',
  'auth.submit': 'Přihlásit se',
  'auth.submitting': 'Přihlašuji…',
  'auth.invalid': 'Nesprávné přihlašovací údaje. Zkuste to znovu.',
  'auth.noAccount': 'Jste správce SVJ / BD bez účtu?',
  'auth.createAdmin': 'Vytvořit účet správce',
  'auth.haveAccount': 'Už máte účet?',
  'auth.signIn': 'Přihlásit se',
  'admin.register.title': 'Vytvořit účet správce',
  'admin.register.subtitle': 'Založíme účet. V dalším kroku vytvoříte první budovu a nahrajete byty.',
  'admin.register.firstName': 'Jméno',
  'admin.register.lastName': 'Příjmení',
  'admin.register.password': 'Heslo (minimálně 10 znaků)',
  'admin.register.submit': 'Pokračovat',
  'admin.register.submitting': 'Vytvářím účet…',
  'dashboard.greeting.morning': 'Dobré ráno',
  'dashboard.greeting.day': 'Dobrý den',
  'dashboard.greeting.evening': 'Dobrý večer',
  'dashboard.chooseBuilding': 'Vyberte budovu, kterou chcete spravovat nebo si prohlédnout.',
  'dashboard.yourBuildings': 'Vaše budovy',
  'dashboard.empty.title': 'Zatím žádná budova',
  'dashboard.empty.body': 'Požádejte správce o aktivační kód z vyúčtování.',
  'building.back': '← Zpět',
  'building.title': 'Moje budova',
  'building.subtitle': 'Přehled hlasování, oznámení, faktur a schůzí.',
  'votings.title': 'Hlasování',
  'votings.empty.title': 'Žádné aktivní hlasování',
  'votings.empty.body': 'Jakmile předseda vytvoří hlasování, zobrazí se zde.',
  'announcements.title': 'Nástěnka',
  'announcements.empty.title': 'Žádná nová oznámení',
  'announcements.empty.body': 'Zde se zobrazí informace o odstávkách a událostech.',
  'tickets.title': 'Závady',
  'tickets.empty.title': 'Žádné nahlášené závady',
  'tickets.empty.body': 'Vše funguje. Cokoliv nefunguje, nahlaste v mobilní aplikaci.',
  'invoices.title': 'Faktury a vyúčtování',
  'invoices.empty.title': 'Zatím žádné faktury',
  'invoices.empty.body': 'Správce je vystaví každý měsíc — zobrazí se zde.',
  'invoices.showQr': 'Zaplatit QR kódem',
  'invoices.qrHint': 'Naskenujte mobilním bankovnictvím — převod se předvyplní.',
  'invoices.closeQr': 'Zavřít',
  'meetings.title': 'Schůze vlastníků',
  'meetings.empty.title': 'Žádná plánovaná schůze',
  'meetings.empty.body': 'Předseda zde zveřejní termín a program.',
  'meetings.agenda': 'Program schůze',
  'meetings.uploadMinutes': 'Nahrát zápis (PDF)',
  'meetings.downloadMinutes': 'Stáhnout zápis',
  'balance.outstanding': 'Nedoplatek',
  'balance.noOutstanding': 'Bez nedoplatku',
  'balance.unpaidCount': '{{n}} neuhrazených faktur',
  'balance.allPaid': 'Všechny faktury zaplaceny',
  'balance.totalInvoices': 'Celkem faktur',
  'balance.totalInvoicesSub': 'Včetně zaplacených',
  'admin.title': 'Správa budovy',
  'admin.uploadXlsx': 'Nahrát .xlsx',
  'admin.importing': 'Importuji…',
  'admin.template': 'Šablona (.xlsx)',
  'admin.codesPdf': 'Aktivační kódy (PDF)',
  'admin.bankImport': 'Import bankovního výpisu (CSV)',
  'admin.importedCount': 'Vytvořeno: {{n}}',
  'admin.skippedCount': 'Přeskočeno (existují): {{n}}',
  'admin.errorsCount': 'Chyby: {{n}}',
  'admin.bankMatched': 'Spárováno: {{n}}',
  'admin.bankUnmatched': 'Nespárováno: {{n}}',
  'admin.stats.apartments': 'Byty',
  'admin.stats.registered': 'Registrovaní vlastníci',
  'admin.stats.openTickets': 'Aktivní závady',
  'admin.stats.outstanding': 'Nedoplatky celkem',
  'wizard.step1': 'Registrace',
  'wizard.step2': 'Budova',
  'wizard.step3': 'Byty',
  'wizard.step4': 'Hotovo',
};

const DICTS: Record<Locale, Dict> = { SK: sk, CS: cs };

export const I18nContext = createContext<Locale>('SK');

export function useT() {
  const locale = useContext(I18nContext);
  return function t(key: string, params?: Record<string, string | number>): string {
    const dict = DICTS[locale] ?? sk;
    let s = dict[key] ?? sk[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replaceAll(`{{${k}}}`, String(v));
      }
    }
    return s;
  };
}

export function translate(locale: Locale, key: string, params?: Record<string, string | number>) {
  const dict = DICTS[locale] ?? sk;
  let s = dict[key] ?? sk[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{{${k}}}`, String(v));
  return s;
}
