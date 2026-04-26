/**
 * Legal stránky — statický obsah, všetky pod /legal/*.
 *
 *   /obchodne-podmienky   — T&Cs pre SaaS
 *   /ochrana-udajov       — GDPR privacy notice
 *   /spracovanie-udajov   — DPA (Data Processing Agreement) — Floory je spracovateľ
 *
 * Obsah je realisticky napísaný pre SK/CZ SVB/BD kontext.
 * IČO / právny subjekt dopĺňaš po založení s.r.o.
 */
import { Link } from 'react-router-dom';

function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <nav className="legal-breadcrumb">
          <Link to="/">Domov</Link> › <span>{title}</span>
        </nav>
        <h1 className="legal-h1">{title}</h1>
        <p className="legal-updated">Posledná aktualizácia: {updated}</p>
        <div className="legal-content">{children}</div>
        <footer className="legal-footer">
          <p>
            Máte otázku k tomuto dokumentu? Napíšte na <a href="mailto:legal@floory.sk">legal@floory.sk</a>.
          </p>
          <Link to="/" className="mk-btn mk-btn-secondary">← Späť na hlavnú stránku</Link>
        </footer>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Obchodné podmienky" updated="24. apríla 2026">
      <h2>1. Úvodné ustanovenia</h2>
      <p>
        Tieto obchodné podmienky (ďalej len <strong>„Podmienky"</strong>) upravujú vzťah medzi prevádzkovateľom
        služby Floory (ďalej len <strong>„Poskytovateľ"</strong>) a registrovaným užívateľom (ďalej len
        <strong> „Zákazník"</strong>), ktorým je spravidla spoločenstvo vlastníkov bytov (SVB), bytové
        družstvo (BD) alebo správcovská spoločnosť v Slovenskej republike alebo Českej republike.
      </p>
      <p>
        Služba Floory je softvér ako služba (SaaS) pre digitálnu správu bytového domu — hlasovania
        vlastníkov, evidencia faktúr, poruchové tikety, schôdze, archív dokumentov.
      </p>

      <h2>2. Uzavretie zmluvy</h2>
      <p>
        Zmluva vzniká akceptovaním týchto Podmienok počas registrácie budovy v systéme Floory. Zákazník
        potvrdzuje, že má oprávnenie konať za právnický subjekt, ktorý registruje (napríklad mandát predsedu
        SVB).
      </p>

      <h2>3. Doba trvania a ukončenie</h2>
      <p>
        Zmluva sa uzatvára na dobu neurčitú s mesačným fakturačným obdobím. Zákazník môže zmluvu ukončiť
        kedykoľvek bez výpovednej doby. Ukončenie nadobúda účinnosť posledným dňom kalendárneho mesiaca,
        v ktorom bola doručená výpoveď. Poskytovateľ zaručuje, že Zákazník dostane kompletný export svojich
        dát (PDF + CSV) do 14 dní od ukončenia.
      </p>

      <h2>4. Cena a platobné podmienky</h2>
      <ul>
        <li>Štandardný plán: <strong>2,49 € bez DPH / byt / mesiac</strong></li>
        <li>Fakturácia mesačne pozadu, splatnosť 14 dní</li>
        <li>Platba prevodom na účet Poskytovateľa (SEPA)</li>
        <li>V prípade omeškania platby viac ako 30 dní môže Poskytovateľ obmedziť prístup do doby zaplatenia</li>
        <li>Pilot partneri (prvé 3 SVB/BD) — <strong>prvý rok zdarma</strong> podľa samostatnej dohody</li>
      </ul>

      <h2>5. Dostupnosť služby</h2>
      <p>
        Poskytovateľ sa zaväzuje udržiavať dostupnosť služby na úrovni <strong>99 % mesačne</strong>
        (okrem plánovanej údržby, ktorá sa oznamuje 48 hodín vopred). Aktuálny stav služieb:
        {' '}<Link to="/status">status.floory.sk</Link>.
      </p>

      <h2>6. Ochrana dát a zálohovanie</h2>
      <p>
        Dáta Zákazníka sú uchovávané v dátovom centre na území EÚ. Poskytovateľ počas pilotu vykonáva
        zálohovanie databázy <strong>týždenne</strong>; po ukončení pilotu bude frekvencia navýšená na
        <strong> denné zálohy</strong> s 30-dňovou retenciou. Detaily spracovania osobných údajov
        sú v samostatnom dokumente{' '}<Link to="/ochrana-udajov">Ochrana údajov</Link> a{' '}
        <Link to="/spracovanie-udajov">Zmluva o spracovaní údajov</Link>.
      </p>

      <h2>7. Zodpovednosť</h2>
      <p>
        Poskytovateľ nezodpovedá za škody spôsobené nesprávnym používaním systému Zákazníkom, za
        rozhodnutia prijaté na základe elektronického hlasovania (tieto sú zodpovednosťou SVB/BD)
        ani za prípadné pokuty za oneskorené povinnosti (revízie, účtovníctvo). Systém poskytuje
        pripomienky a nástroje, ale právnu zodpovednosť nesie štatutárny orgán Zákazníka.
      </p>

      <h2>8. Právo rozhodné a súdna príslušnosť</h2>
      <p>
        Tieto Podmienky sa riadia právnym poriadkom Slovenskej republiky. Spory budú riešené pred
        vecne a miestne príslušným súdom v Bratislave.
      </p>

      <h2>9. Záverečné ustanovenia</h2>
      <p>
        Poskytovateľ si vyhradzuje právo tieto Podmienky meniť s predchádzajúcim oznámením 30 dní vopred
        (email + notifikácia v aplikácii). Ak Zákazník so zmenami nesúhlasí, má právo vypovedať zmluvu
        pred nadobudnutím účinnosti zmien.
      </p>

      <hr />
      <p className="legal-meta">
        <strong>Poskytovateľ:</strong> Floory s.r.o. (v registrácii), Bratislava, Slovensko.<br />
        Presné registračné údaje (IČO, DIČ, adresa) budú doplnené po zápise do Obchodného registra.
        Pre predzmluvnú komunikáciu používajte <a href="mailto:hello@floory.sk">hello@floory.sk</a>.
      </p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Ochrana osobných údajov" updated="24. apríla 2026">
      <p className="legal-lede">
        Tento dokument vysvetľuje, aké osobné údaje o vás Floory spracúva, prečo a ako ich chránime.
        Spracovanie prebieha v súlade s Nariadením GDPR (EÚ) 2016/679 a zákonom č. 18/2018 Z. z.
        o ochrane osobných údajov.
      </p>

      <h2>1. Kto sme</h2>
      <p>
        Prevádzkovateľom služby Floory je Floory s.r.o. (v registrácii). Kontakt pre otázky ochrany
        údajov: <a href="mailto:privacy@floory.sk">privacy@floory.sk</a>.
      </p>

      <h2>2. Aké údaje spracúvame</h2>
      <h3>Pri registrácii predsedu / správcu:</h3>
      <ul>
        <li>Meno a priezvisko, email, telefón (voliteľne)</li>
        <li>Názov a adresa budovy, počet bytov</li>
        <li>Prihlasovacie údaje (heslo v hashovanej forme — bcrypt)</li>
      </ul>
      <h3>Pri registrácii vlastníka cez aktivačný kód:</h3>
      <ul>
        <li>Meno a priezvisko, email</li>
        <li>Číslo bytu (priradenie k nehnuteľnosti)</li>
        <li>Voliteľne: telefón pre SMS / Viber notifikácie</li>
      </ul>
      <h3>Počas používania:</h3>
      <ul>
        <li>Záznamy o hlasovaniach (zachované pre právnu nespochybniteľnosť — hash-chain audit log)</li>
        <li>Poruchové tikety, komentáre, nahrané fotografie</li>
        <li>Platby, faktúry, stav úhrad</li>
        <li>Technické údaje: IP adresa, typ prehliadača, timestamp prihlásenia (pre bezpečnostný audit)</li>
      </ul>

      <h2>3. Prečo ich spracúvame (právny základ)</h2>
      <ul>
        <li><strong>Plnenie zmluvy</strong> (čl. 6 ods. 1 písm. b GDPR) — poskytovanie služieb Floory</li>
        <li><strong>Zákonná povinnosť</strong> (čl. 6 ods. 1 písm. c) — archivácia účtovných dokladov 10 rokov</li>
        <li><strong>Oprávnený záujem</strong> (čl. 6 ods. 1 písm. f) — bezpečnostné logy, detekcia zneužitia</li>
        <li><strong>Súhlas</strong> (čl. 6 ods. 1 písm. a) — marketing, newsletter (vždy s možnosťou odhlásenia)</li>
      </ul>

      <h2>4. Ako dlho údaje uchovávame</h2>
      <ul>
        <li>Osobné údaje aktívnych používateľov — počas trvania zmluvy</li>
        <li>Audit log hlasovaní a zápisnice — 10 rokov (právna archivácia)</li>
        <li>Účtovné doklady — 10 rokov (zákon č. 431/2002 Z. z.)</li>
        <li>Po ukončení zmluvy: osobné údaje (okrem archivácie vyššie) sa anonymizujú do 30 dní</li>
      </ul>

      <h2>5. Komu údaje odovzdávame</h2>
      <p>
        Osobné údaje nepredávame a neposkytujeme tretím stranám na marketingové účely. Spolupracujeme
        iba s týmito subdodávateľmi, ktorí sú viazaní zmluvou o spracovaní údajov (GDPR čl. 28):
      </p>
      <ul>
        <li><strong>Hetzner Online GmbH</strong> (Nemecko) — cloudová infraštruktúra pre vývoj</li>
        <li><strong>Websupport s.r.o.</strong> (Slovensko) — produkčné hostovanie v EÚ</li>
        <li><strong>Resend / Mailgun</strong> (EÚ) — transakčné emaily (potvrdenia, pripomienky)</li>
        <li>Poskytovateľ webovej analytiky (Plausible, hostovaný v EÚ) — bez cookies, anonymizované</li>
      </ul>

      <h2>6. Prenos mimo EÚ</h2>
      <p>
        K prenosom osobných údajov mimo EÚ <strong>nedochádza</strong>. Všetci naši subdodávatelia hostujú
        dáta výhradne na území EÚ.
      </p>

      <h2>7. Vaše práva</h2>
      <p>V súlade s GDPR máte právo:</p>
      <ul>
        <li>Požiadať o prístup k vašim osobným údajom (čl. 15)</li>
        <li>Opraviť nesprávne údaje (čl. 16)</li>
        <li>Žiadať vymazanie („právo byť zabudnutý") — s výnimkou zákonnej archivácie (čl. 17)</li>
        <li>Obmedziť spracovanie (čl. 18)</li>
        <li>Prenosnosť údajov — export vo formáte JSON/CSV (čl. 20)</li>
        <li>Namietať proti spracovaniu (čl. 21)</li>
        <li>Podať sťažnosť Úradu na ochranu osobných údajov SR (<a href="https://dataprotection.gov.sk" target="_blank" rel="noreferrer">dataprotection.gov.sk</a>)</li>
      </ul>
      <p>
        Žiadosti zasielajte na <a href="mailto:privacy@floory.sk">privacy@floory.sk</a>. Odpovedáme
        do 30 dní.
      </p>

      <h2>8. Cookies a sledovanie</h2>
      <p>
        Floory používa iba <strong>technicky nevyhnutné cookies</strong> pre prihlásenie a bezpečnosť
        (JWT token, CSRF). Neposkytujeme dáta tretím stranám na reklamu, nepoužívame Google Analytics
        ani Meta Pixel. Webová analytika prebieha cez Plausible, ktorý neukladá cookies ani IP adresy.
      </p>

      <h2>9. Bezpečnostné opatrenia</h2>
      <ul>
        <li>Šifrované spojenie HTTPS (TLS 1.3)</li>
        <li>Heslá hashované algoritmom bcrypt (cost 12)</li>
        <li>JWT tokeny s krátkou životnosťou (15 min access + 7 dní refresh)</li>
        <li>Dvojfaktorové overenie (TOTP) pre účty s admin prístupom</li>
        <li>Hash-chain audit log (SHA-256) — záznamy sa nedajú prepísať</li>
        <li>Pravidelné zálohovanie databázy (týždenne počas pilotu, denne po nasadení)</li>
      </ul>
    </LegalLayout>
  );
}

export function DpaPage() {
  return (
    <LegalLayout title="Zmluva o spracovaní osobných údajov (DPA)" updated="24. apríla 2026">
      <p className="legal-lede">
        Tento dokument je <strong>Zmluvou o spracovaní osobných údajov</strong> podľa čl. 28 GDPR.
        Uzatvára sa medzi <strong>Prevádzkovateľom</strong> (SVB / BD / správcovská firma používajúca
        Floory) a <strong>Sprostredkovateľom</strong> (Floory s.r.o.). Je súčasťou obchodných
        podmienok a stáva sa záväzným momentom registrácie budovy v systéme.
      </p>

      <h2>Predmet spracovania</h2>
      <p>
        Sprostredkovateľ spracúva osobné údaje v mene Prevádzkovateľa výhradne za účelom
        poskytovania služby Floory — softvérovej platformy pre správu bytového domu.
      </p>

      <h2>Kategórie dotknutých osôb</h2>
      <ul>
        <li>Členovia štatutárnych orgánov (predseda, členovia výboru)</li>
        <li>Vlastníci bytov a nebytových priestorov</li>
        <li>Nájomcovia (ak ich Prevádzkovateľ evidencuje)</li>
        <li>Externí dodávatelia (správca, údržbár) — kontaktné údaje</li>
      </ul>

      <h2>Kategórie osobných údajov</h2>
      <ul>
        <li>Identifikačné údaje: meno, priezvisko</li>
        <li>Kontaktné údaje: email, telefón, korešpondenčná adresa</li>
        <li>Údaje o nehnuteľnosti: číslo bytu, podlahová plocha, spoluvlastnícky podiel</li>
        <li>Finančné údaje: predpisy platieb, úhrady, nedoplatky (bez čísla účtu — iba variabilný symbol)</li>
        <li>Údaje o hlasovaniach: elektronický hlas s časovou pečiatkou, session fingerprint</li>
        <li>Prihlasovacie údaje: email, hash hesla, TOTP secret (ak je 2FA zapnuté)</li>
      </ul>

      <h2>Povinnosti Sprostredkovateľa</h2>
      <ol>
        <li>Spracúvať osobné údaje iba na základe doložených pokynov Prevádzkovateľa</li>
        <li>Zabezpečiť mlčanlivosť všetkých osôb, ktoré majú prístup k údajom</li>
        <li>Implementovať technické a organizačné opatrenia podľa čl. 32 GDPR (šifrovanie, prístupové kontroly, audit logy)</li>
        <li>Pomáhať Prevádzkovateľovi s plnením žiadostí dotknutých osôb (prístup, oprava, vymazanie, prenosnosť)</li>
        <li>Bezodkladne informovať Prevádzkovateľa o akomkoľvek porušení bezpečnosti údajov (najneskôr do 72 hodín)</li>
        <li>Po ukončení zmluvy dáta na základe voľby Prevádzkovateľa vymazať alebo vrátiť, okrem prípadov zákonnej archivácie</li>
      </ol>

      <h2>Ďalší spracovatelia (subprocesory)</h2>
      <p>
        Prevádzkovateľ súhlasí so zapojením týchto subprocesorov. Aktualizovaný zoznam je
        zverejnený na <Link to="/ochrana-udajov">ochrana-udajov</Link>, časť 5.
      </p>
      <ul>
        <li>Hetzner Online GmbH (Nemecko) — infraštruktúra</li>
        <li>Websupport s.r.o. (SR) — produkčné hosting</li>
        <li>Resend / Mailgun (EÚ) — transakčné emaily</li>
      </ul>
      <p>
        Pri zmene subprocesorov Sprostredkovateľ oznámi zmenu 30 dní vopred, aby Prevádzkovateľ
        mohol namietnuť.
      </p>

      <h2>Prenos mimo EÚ</h2>
      <p>
        K prenosom mimo EÚ/EHP nedochádza. Ak by v budúcnosti došlo k potrebe takého prenosu, bude
        sa realizovať výhradne na základe Štandardných zmluvných doložiek EÚ (čl. 46 ods. 2 písm. c GDPR).
      </p>

      <h2>Doba trvania</h2>
      <p>
        Táto DPA nadobúda účinnosť v deň registrácie budovy v systéme a trvá počas celej doby
        poskytovania služby. Ukončením hlavnej zmluvy končí automaticky aj DPA.
      </p>

      <h2>Auditné práva</h2>
      <p>
        Prevádzkovateľ má právo (max. 1× ročne, s predchádzajúcim oznámením 30 dní) overiť plnenie
        povinností Sprostredkovateľa. Sprostredkovateľ na požiadanie poskytne aktuálny bezpečnostný
        audit (ISO 27001 compliance report alebo ekvivalent), keď bude k dispozícii.
      </p>

      <hr />
      <p className="legal-meta">
        Akceptovanie tejto DPA sa zaznamenáva pri registrácii s časovou pečiatkou, IP adresou a menom
        osoby, ktorá akceptáciu vykonala. Kópiu akceptovanej DPA si môžete kedykoľvek stiahnuť v nastaveniach
        svojho účtu.
      </p>
    </LegalLayout>
  );
}
