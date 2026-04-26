# Floory Onboarding & Setup — Komplexná analýza

**Dátum:** 26. apríla 2026  
**Projekt:** Floory (SVB/BD správa bytových domov)  
**Autor:** Claude Opus  
**Štav:** Analýza aktuálneho stavu + návrhy zlepšení

---

## 📋 Obsah

1. **Aktuálny stav** (čo máme)
2. **Identifikované problémy** (čo nefunguje)
3. **Chýbajúce funkcionality** (čo máme mať)
4. **Dizajnové problémy** (UI/UX vylepšenia)
5. **Technické návrhy riešení** (ako to opraviť)
6. **Prioritizácia** (čo urobiť ako prvé)

---

## 1. AKTUÁLNY STAV

### Krok 1: Základné údaje budovy ✅ Existuje

**Vytvára:**
- Building record s názvom, adresou, mestom, PSČ, krajinou, právnou formou, IČO

**Pole:**
- `name` (Názov budovy) — text input
- `address` — text input
- `city` — text input
- `zip` — text input
- `country` — SK/CZ select
- `legalForm` — SVB/BD/SVJ select
- `ico` — voliteľné, text input

**Chyby/Limity:**
- ❌ Bez vyhľadávania adresy podľa oficiálneho zdroja
- ❌ Bez autofill z registru (finstat, ORSR, ARES)
- ❌ Bez validácie formátu adresy
- ⚠️ "Sabolna" (?) je po anglicky, nie je správne — možno chýba komponent

### Krok 2: Byty a vlastníci ✅ Existuje

**Vytvára:**
- Apartment records import z XLSX — parser pre unitNumber, firstName, lastName, email, icpa (?)

**Funkcie:**
- Upload XLSX/XLS/CSV file
- Stiahnúť šablónu (template.xlsx)
- Zobrazuje výsledok: created, skipped, errors

**Chyby/Limity:**
- ❌ Bez možnosti manuálne pridávať byty po jednom
- ❌ Bez preview bytov pred potvrdením
- ⚠️ Bez možnosti editovať bytové údaje po importe
- ⚠️ Bez detailného výstupu chýb (iba riadok + sprievodný text)

### Krok 3: Fakturačné údaje SVB/BD ✅ Existuje

**Vytvára:**
- BillingData — billingName, billingIco, billingDic, billingVatId, billingAddress, billingIban, billingBic, billingBankName, billingRegistry, invoiceFooterNote

**Funkcie:**
- CompanyNameSearch — hľadá podľa mena
- IcoLookupHint — auto-fill z IČO (finstat, ORSR, ARES)
- Ručný zápis všetkých polí

**Chyby/Limity:**
- ❌ IBAN bez formátovania (bez separácie medzi block/numeric)
- ❌ Bez automatickej normalizácie IBAN (spacing, case)
- ❌ Bez validácie IBAN (kontrolný súčet)
- ❌ Bez auto-lookupup BIC podľa IBANU
- ⚠️ BIC pole nie je povinné (malo by byť ak je IBAN)
- ⚠️ Bez kontroly kódu banky v IBANU
- ⚠️ Bez vysvetlenia jednotlivých polí (dlhý form bez helpu)

### Krok 4: Hotovo ✅ Existuje

**Funkcie:**
- Tlačidlo "Aktivačné kódy (PDF)" — download PDF
- Tlačidlo "Prejsť do budovy"

**Chyby/Limity:**
- ❌ Bez zobrazenia zoznamu bytov (koľko ich bolo vytvorených)
- ❌ Bez možnosti generovať/regenerovať aktivačné kódy
- ❌ Bez možnosti upraviť byty pred kódmi (opraviť chyby z imporru)
- ❌ PDF download "sa nič nestane" — bez feedback (busy state, success msg)
- ⚠️ User neví čo s kódmi robiť (neexistuje sprievodca)

---

## 2. IDENTIFIKOVANÉ PROBLÉMY

### 2.1 Adresy bez validácie a bez oficiálneho zdroja

**Problém:** Užívateľ ručne zadá adresu, bez overenia či je korektná. Banky a pošta majú štandardizovaný formát (ruian.vúsc.sk, pošta.sk API atď.).

**Dopad:** Faktúry s chybnými adresami, zápisnice s nesprávnymi informáciami.

**Príklad zlého:**
- "Hviezdoslavova 12 Bratislava" (bez PSČ)
- "Hviezdoslavova 12, Bratislava 811 02" (obrátené poradie)
- "Hviezdoslawova 12" (opčo)

### 2.2 Byty — bez možnosti editovať po importe

**Problém:** Ak sa v importe stane chyba (časť bytov sa naimportuje zle), user nemôže byť editovať a musí začať od nového (znova upload).

**Dopad:** Frustrácia, straty času, nutnosť opakovať celý flow.

### 2.3 IBAN bez formátovania a bez BIC

**Problém:**
- User zadá IBAN bez medier alebo s medierami — bez normalizácie
- BIC sa zadáva ručne, bez auto-lookup
- Bez validácie IBAN (kontrolný súčet)

**Dopad:** Chybné platby (IBAN nevalidný), nesprávne BIC (overovacia chyba v banke).

**Príklad:** `SK00 0000 0000 0000 0000 0000` — správny formát  
vs. `SK000000000000000000000000` — bez medier (tlmavý, ľudí chyby)

### 2.4 PDF aktivačných kódov — bez feedbacku

**Problém:** User klikne "Stiahnúť aktivačné kódy" a nič sa nestane (bez loading state, bez potvrdenia).

**Dopad:** User klikne znova, znova, znova — skúša či sa niečo deje.

### 2.5 Žiadna sprievodca aplikácia

**Problém:** Nový užívateľ nevie:
- Čo má robiť s PDF kódmi (tlačiť? posielať email?)
- Ako bytový dom funguje
- Čo je vlastník, predseda, správca
- Čo je hlasovanie, faktúra, schôdza

**Dopad:** Zmatení novci používatelia, podpora, chyby v nastavení.

### 2.6 Nastavenie budovy — bez správcu-only editovania

**Problém:** Neexistuje rola-based kontrola na Krok 3. Akýkoľvek admin môže editovať fakturačné údaje — malo by to byť iba pre správcu budovy.

**Dopad:** Bezpečnosť, audit trail, správnosť údajov.

### 2.7 Stav wizardu — bez persistencie

**Problém:** Ak user odchádza v Kroku 2 a vráti sa, všetko je zabudnuté (state sa vyresetuje).

**Dopad:** Nutnosť začať od nového, frustrácia.

### 2.8 Bez on-screen helpov a tooltips

**Problém:** Polia bez vysvetlenia:
- "IČ DPH (ak ste platca)" — čo to znamená?
- "Zápis v registri" — aké formáty?
- "Pätička faktúry" — čo tam patrí?

**Dopad:** Falošné údaje, opravy neskôr.

---

## 3. CHÝBAJÚCE FUNKCIONALITY

### 3.1 Adresa — oficialný lookup

**Čo treba:**
- Input s autocomplete pre adresy (RUIAN.SK pre SK, RUIAN.CZ pre CZ)
- Fallback: hľadaj v OpenStreetMap (nominatim API)
- Normalizácia formátu (ulica, č.p., PSČ, mesto, krajina)
- Validácia IČO budovy podľa ORSR/finstat (popisy IČO + adresa sa zhoduje)

**API/zdroje:**
- SK: [RUIAN API](https://geoproxy.npu.gov.sk/arcgis/rest/services/RUIAN/Adresy/FeatureServer) (free)
- CZ: [RUIÁN API](https://www.cuzk.cz/Uvod/Produkty-a-sluzby/RUIAN/RUIAN.aspx)
- OpenStreetMap Nominatim (free, no auth)

**Priorita:** 🔴 **HIGH** — chyby v adresách spôsobujú problemy s faktúrami

### 3.2 Byty — inline editing + preview

**Čo treba:**
- Po importe: tabuľka s bytmi, možnosť editovať:
  - unitNumber (číslo bytu)
  - shares (počet podielov, ak je to potrebné)
  - firstName, lastName (vlastníka)
  - email (kontakt)
- Tlačidlo "Pridať byt" — form na manuálne pridávanie
- Tlačidlo "Odstrániť byt" (pred potvrdením)
- Počet bytov + kontrolný súčet podielov

**Priorita:** 🔴 **HIGH** — bez editovania sú importe nepoužiteľné ak je chyba

### 3.3 IBAN — normalizácia + validácia + BIC lookup

**Čo treba:**
- Input na IBAN:
  - Auto-format: `SK00 0000 0000 0000 0000 0000` (4+4+4+4+4+4)
  - Validácia: MOD97 kontrolný súčet (IBAN je krásny, presne o to je to)
  - Auto-detect krajina z prvých 2 znakov
- BIC lookup (alebo user-input ak lookup zlyhal):
  - SK: použiť lookup tabuľka (Tatra = TATRSKBX, atď.)
  - CZ: ČNBS BIC registry
  - Zobrazenie banky "Vaša banka je: Tatra banka, a.s."
- Validácia: IBAN musí byť povinný, BIC sa odporúča

**Priorita:** 🟠 **MEDIUM-HIGH** — chyby IBAN = chybné platby

### 3.4 PDF aktivačných kódov — ako sprievodca

**Čo treba:**
- Krok Hotovo sa zmení na viacstránkový sprievodca:
  1. **Prehľad** — "Budova XYZ je pripravená, vytvorili sme 12 bytov"
  2. **Tabuľka bytov** — číslo, vlastník email (bez hesel!)
  3. **PDF vygenerovanie** — tlačidlo s loading state
  4. **PDF preview** — show PDF inline
  5. **Možnosti doručenia:**
     - "Vytlačiť a fyzicky" — link na PDF
     - "Poslať emaily" — mass-send aktivačných kódov (form na email template)
  6. **Čo ďalej?** — link na dashboard budovy

**Priorita:** 🔴 **HIGH** — bez sprievodcu sú kódy nepoužiteľné

### 3.5 Sprievodca aplikácia (In-app onboarding)

**Čo treba:**
- "Vitajte v Floory" — tooltip na prvú návštevu
- "Čo je to Floory?" — video/slides (30s)
- "Role" — chairman, owner, manager (obrázky + popisy)
- "Základné termíny" — hlasovanie, faktúra, schôdza, porucha
- Link na Knowledge Base (FAQ, user manual)

**Priorita:** 🟠 **MEDIUM** — bez tohoto sú noví useri zmatení

### 3.6 Nastavenie budovy — rola-based editovanie

**Čo treba:**
- Admin settings pre budovu (nová stránka `/b/:id/nastavenia`):
  - Základné údaje budovy — председа može editovať (name, address, atď.)
  - **Fakturačné údaje — IBA SPRÁVCA** budovy može editovať
  - Členov — predseda spravuje, ale správca (manager) vidí (readonly)
  - Email nastavenia (template pre faktúry, upozornenia)
  - Audit log — kto čo zmenil
- Info tipov pri každom poli
- "Poslať pripomienku správcovi" — ak chairman chce zmeniť, ale nemôže

**Priorita:** 🟠 **MEDIUM** — bezpečnosť + audit trail

---

## 4. DIZAJNOVÉ PROBLÉMY

### 4.1 Layout — velmi rozpätý

**Problém:** Krok 1-4 je v card s `maxWidth: 640-720px`, ale ostatný priestor je prázdny. Na wide screenoch to vyzerá divne.

**Riešenie:** 
- Sidebar s progress + tips
- Alebo: Full-width modal s "next/prev" navigáciou
- Alebo: Responsive grid layout — left: form, right: preview/help

### 4.2 Step 3 — príliš dlhý form

**Problém:** 8+ polí bez akýchkoľvek sekcií. User sa musí scrollovať. Neprehľadné.

**Riešenie:**
- Rozdeliť na sekcie (collapsible):
  - **Základné** — Názov, IČO
  - **Daňové** — DIČ, IČ DPH
  - **Adresa + IBAN** — 2 stĺpce
  - **Pätička** — poznámky
- Alebo: "Vľavo form, vpravo preview faktúry" (real-time mockup ako bude vyzerať)

### 4.3 Step 4 — neinteraktívne

**Problém:** Iba dve tlačidlá bez kontextu. User nevidí čo sa stalo, čo majú robiť s kódmi.

**Riešenie:**
- Zobraziť zoznam bytov (tabuľka: byty, vlastníci, kódy)
- Zobrazí Progress: "✓ Budova vytvorená | ✓ 12 bytov | ▶ Vygenerovať kódy"
- PDF preview inline (nie len download link)

### 4.4 Chýbajú visuálne odlíšenia

**Problém:** Všetky inputy sú rovnaké. Návštevník nevidí, čo je povinné (*) a čo nie.

**Riešenie:**
- Povinné polia: červená * (je to, ale nie je viditeľné)
- Odporúčané polia: modrá ? (info icon s tooltipom)
- Vyplnené polia vs. prázdne — vizuálna diferencia

### 4.5 Bez error recovery

**Problém:** Keď sa import zlyhal (napr. chybný XLSX), user vidí "Chyba" a musí znova klikať na upload. Bez možnosti vidieť, čo sa stalo (bez logu).

**Riešenie:**
- Detailný error log s riadkami a príčinami
- "Chyby" sekcí s možnosťou "Zobraziť" / "Skryť"
- Button "Skúsiť znova" — user nemá odsúť znova hľadať file

---

## 5. TECHNICKÉ NÁVRHY RIEŠENÍ

### 5.1 Address Lookup (Krok 1)

```typescript
// Nový hook: useAddressLookup
interface AddressResult {
  address: string;
  city: string;
  zip: string;
  // Plus: coordinates (lat/lng), administrativeArea, atď.
}

async function lookupAddress(query: string, country: 'SK' | 'CZ'): Promise<AddressResult[]> {
  // Priority 1: RUIAN API (SK/CZ)
  // Priority 2: OpenStreetMap Nominatim
  // Return: [{ address, city, zip }, ...]
  // UI: Autocomplete dropdown, user selects one
}
```

**Typ:** Frontend component + Backend (proxy, aby sme nešli priamo do RUIAN)

### 5.2 Apartment Editor (Krok 2 Enhancement)

```typescript
// Komponenty:
<ApartmentImporter /> // existujúci file upload
<ApartmentTable 
  apartments={imported}
  onEdit={(id, updates) => ...}
  onDelete={(id) => ...}
  onAdd={(apt) => ...}
/>
<ApartmentForm mode="add|edit" onSubmit={...} />
```

**Typ:** React components (frontend)

### 5.3 IBAN Formatter + Validator (Krok 3)

```typescript
// Backend utility
function formatIban(iban: string): string {
  // Remove spaces, uppercase
  // Validate length by country
  // Insert spaces: `SK00 0000 0000 0000 0000 0000`
  // Return formatted or error
}

function validateIban(iban: string): boolean {
  // MOD97 check (IBAN spec)
  // Country check (SK/CZ)
  // Length check
}

// BIC Lookup
async function lookupBicByIban(iban: string): Promise<{
  bic: string;
  bankName: string;
  country: string;
}> {
  // SK: SWIFT registry lookup (external API or cached DB)
  // CZ: ČNBS BIC registry
  // Return: { bic, bankName }
}
```

**Typ:** Backend utility functions (NestJS service)

**Frontend:**
```typescript
<IbanInput
  value={iban}
  onChange={setIban}
  onValidate={validateIban}
  onBlur={() => {
    const bic = await lookupBicByIban(iban);
    if (bic) setBic(bic);
  }}
/>
```

### 5.4 Activation Codes PDF Workflow

**Backend (new endpoint):**
```typescript
POST /buildings/:id/activation-codes/generate
// Request: { regenerate?: boolean }
// Response: { codesGenerated: 12, existingCodes?: 12 }

GET /buildings/:id/apartments?withCodes=true
// Response: { apartments: [{ unitNumber, owner, code, ... }] }
```

**Frontend (Krok 4):**
```typescript
<ActivationCodesWizard building={building}>
  <Step name="overview">Budova je pripravená. {apartmentCount} bytov.</Step>
  <Step name="apartments">
    <ApartmentTable apartments={apts} columns={['unitNumber', 'owner', 'code']} />
  </Step>
  <Step name="generate">
    <button onClick={generateCodes}>Vygenerovať kódy</button>
    <button onClick={downloadPdf}>Stiahnúť PDF</button>
  </Step>
  <Step name="delivery">
    <RadioGroup>
      <Radio value="print">Vytlačiť PDF</Radio>
      <Radio value="email">Poslať emaily vlastníkom</Radio>
      <Radio value="sms">Poslať SMS (ak máme phone)</Radio>
    </RadioGroup>
  </Step>
</ActivationCodesWizard>
```

**Typ:** Backend endpoints + Frontend components

### 5.5 In-App Onboarding (Sprievodca aplikácia)

**Techstack:** React Spotlight / Joyride / custom Tooltip component

```typescript
// useOnboarding hook
const { currentStep, next, skip, isComplete } = useOnboarding('first-login');

// Show tooltips based on step
<Tooltip
  visible={currentStep === 'welcome'}
  title="Vitajte v Floory"
  body="Toto je aplikácia na správu bytových domov..."
  onNext={() => next()}
/>
```

**Typ:** Frontend (React components + local storage persistence)

### 5.6 Building Settings Page (Rola-based)

**Schéma:** Nový endpoint na API

```typescript
PATCH /buildings/:id/settings
// Request: { setting: 'billing' | 'email' | 'members', data: {...} }
// Response: { building, audit }
// Authorization: Musí byť admin (chairman/manager/admin)
//                Pre 'billing' — iba MANAGER/ADMIN budovy
```

**Frontend:**
```typescript
<BuildingSettings building={building} me={me}>
  <Tab name="general">Základné údaje (Chairman может editovať)</Tab>
  <Tab name="billing">Fakturačné údaje (IBA MANAGER)</Tab>
  <Tab name="email">Email šablóny (Chairman/MANAGER)</Tab>
  <Tab name="audit">Audit log (všetci vidia)</Tab>
</BuildingSettings>
```

**Typ:** Backend endpoint + Frontend page

---

## 6. PRIORITIZÁCIA — Čo robiť ako prvé

### 🔴 P1 — Kritické (Týždeň 1-2)

1. **Byty — Inline Editor**
   - Po importe: tabuľka s možnosťou editovať/odstrániť
   - Button "Pridať byt ručne"
   - Bez toho sú importy nepoužiteľné

2. **IBAN — Validácia + Normalizácia**
   - Format: `SK00 0000 0000 0000 0000 0000`
   - Validácia: kontrolný súčet
   - Bez toho sú faktúry s chybnými účtami

3. **PDF Aktivačné kódy — Feedback + Sprievodca**
   - Loading state pri downloade
   - Step 4 ako viacstránkový sprievodca (Overview → Byty → Generovanie → Doručenie)
   - Bez toho user nevie čo robiť s kódmi

4. **Address Lookup (Krok 1)**
   - Autocomplete s OpenStreetMap Nominatim
   - Normalizácia formátu
   - Bez tego údaje sú často chybné

### 🟠 P2 — Vysoká (Týždeň 3)

5. **BIC Auto-lookup (Krok 3)**
   - Keď user zadá IBAN, auto-fill BIC
   - Lookup table SK/CZ baniek
   - User experience improvement

6. **Building Settings Page** (`/b/:id/nastavenia`)
   - Fakturačné údaje (editovať len MANAGER)
   - Email nastavenia (šablóny pre faktúry)
   - Audit log (kto čo zmenil)

7. **In-App Onboarding** (Sprievodca)
   - Tooltip "Vitajte v Floory" pri prvej návševe
   - Video "Čo je to Floory" (2 min)
   - Link na FAQ/Knowledge Base

### 🟡 P3 — Nízka (Týždeň 4+)

8. **Wizard State Persistence**
   - LocalStorage/SessionStorage pre Krok 1-4
   - Ak user navrhne, môže pokračovať

9. **Form Sections + Tooltips**
   - Rozdeliť Krok 3 na sekcie
   - Info ikonky s vysvetleniami polí
   - Real-time invoice preview (mockup faktúry)

10. **Role-based Editing** (Full implementation)
    - Chairman vs. Manager vs. Admin — rôzne oprávnenia
    - "Poslať pripomienku správcovi" — workflow

---

## 7. IMPLEMENTAČNÝ PLÁN

### Týždeň 1: P1.1 — Byty Editor

**Súbory na úpravu:**
- `apps/web/src/App.tsx` — Step 2 form → add Table
- Nový file: `apps/web/src/components/ApartmentEditor.tsx`
- Backend: `apps/api/src/buildings/apartments.controller.ts` — PATCH `/buildings/:id/apartments/:aptId`

**Tasks:**
- [ ] Design tabuľky (unitNumber, firstName, lastName, email, actions)
- [ ] Implementovať edit modal
- [ ] Implementovať delete confirmation
- [ ] Implementovať "Add apartment" form
- [ ] Validácia (unitNumber musí byť unikátny v budove)
- [ ] Test import + edit flow

**Odborné výstupy:**
- Apartment table s editovateľnosťou
- Lepší user experience po importe

---

### Týždeň 1-2: P1.2 — IBAN Validator + Formatter

**Súbory na úpravu:**
- Nový file: `apps/api/src/utilities/iban.util.ts`
- `apps/web/src/components/IbanInput.tsx` — nový component
- `apps/web/src/App.tsx` — Step 3 → swap textInput za IbanInput

**Tasks:**
- [ ] Implementovať IBAN validator (MOD97)
- [ ] Implementovať IBAN formatter (SK00 XXXX XXXX…)
- [ ] Test s reálnymi IBAN SK/CZ
- [ ] Frontend: real-time validation + formatting
- [ ] Error message: "Neplatný IBAN. Skontroluj…"

**Odborné výstupy:**
- IBAN validation utility
- IbanInput component s formatting

---

### Týždeň 2: P1.3 — PDF Kódy — Sprievodca

**Súbory na úpravu:**
- `apps/web/src/App.tsx` — Step 4 → viacstránková wizard
- Nový file: `apps/web/src/components/ActivationCodesWizard.tsx`

**Tasks:**
- [ ] Design wizard layout (step indicator, prev/next)
- [ ] Step 1: Overview ("Budova X, 12 bytov")
- [ ] Step 2: Apartment table (číslo, vlastník, kód)
- [ ] Step 3: Generovanie (button + loading state)
- [ ] Step 4: PDF preview + download
- [ ] Step 5: Doručenie (print/email/sms options)
- [ ] Test flow end-to-end

**Odborné výstupy:**
- ActivationCodesWizard component
- Lepšia UX pri kódoch

---

### Týždeň 2-3: P1.4 — Address Lookup

**Súbory na úpravu:**
- `apps/api/src/utilities/address.util.ts` — proxy na OpenStreetMap Nominatim
- `apps/web/src/components/AddressInput.tsx` — nový component
- `apps/web/src/App.tsx` — Step 1 → replace address input za AddressInput

**Tasks:**
- [ ] Implementovať Nominatim API proxy (backend)
- [ ] Frontend: Autocomplete component
- [ ] Test s reálnymi adresami SK
- [ ] Normalizácia formátu (ulica, číslo, PSČ, mesto)
- [ ] Error handling (API down, žiadny výsledok)

**Odborné výstupy:**
- Address lookup API
- AddressInput component

---

### Týždeň 3: P2.1 — BIC Auto-lookup

**Súbory na úpravu:**
- `apps/api/src/utilities/bic.util.ts` — BIC lookup table
- `apps/web/src/components/IbanInput.tsx` — upgrade na auto-lookup

**Tasks:**
- [ ] Vytvorí SK/CZ BIC lookup table (Tatra→TATRSKBX, atď.)
- [ ] IbanInput na blur → call `/api/bic/lookup?iban=SK...`
- [ ] Auto-fill BIC field
- [ ] Test s reálnymi IBAN

**Odborné výstupy:**
- BIC lookup API
- Mejor UX (auto-fill)

---

### Týždeň 3-4: P2.2 — Building Settings Page

**Súbory na úpravu:**
- Nový file: `apps/web/src/shells/BuildingSettingsPage.tsx`
- `apps/web/src/shells/ChairmanShell.tsx` — add route
- Backend: `apps/api/src/buildings/buildings.controller.ts` — PATCH settings endpoint

**Tasks:**
- [ ] Design settings page (tabs: general, billing, email, audit)
- [ ] Role-based visibility (Chairman, Manager, Admin)
- [ ] Billing tab: čitateľný pre všetkých, editovateľný len pre MANAGER
- [ ] Email tab: šablóny (faktúra, upozornenie, aktivácia)
- [ ] Audit log: tabuľka zmien (user, čas, čo sa zmenilo)
- [ ] API endpoint na PATCH /buildings/:id/settings

**Odborné výstupy:**
- BuildingSettingsPage component
- Settings API endpoint
- Role-based authorization

---

### Týždeň 4: P2.3 — In-App Onboarding

**Súbory na úpravu:**
- Nový file: `apps/web/src/hooks/useOnboarding.ts`
- Nový file: `apps/web/src/components/OnboardingTooltips.tsx`
- `apps/web/src/App.tsx` — wrap s OnboardingTooltips

**Tasks:**
- [ ] Design tooltips (Joyride/Spotlight)
- [ ] Step 1: "Vitajte v Floory — aplikácia na správu SVB"
- [ ] Step 2: "Role: Predseda, Správca, Vlastník — čo znamenajú"
- [ ] Step 3: "Základné funkcie: Faktúry, Hlasovania, Byty"
- [ ] Persistent state (localStorage — "completed")
- [ ] Button "Preskočiť" a "Pokračovať"
- [ ] Link na Knowledge Base

**Odborné výstupy:**
- Onboarding hook
- Tooltips component
- Knowledge Base links

---

## 8. VÝSTUP A METRIKY

### Metriky úspešnosti

| Metrika | Aktuálne | Cieľ |
|---------|---------|------|
| **Setup completion rate** | ? | >80% |
| **Time to complete onboarding** | ? | <5 min |
| **Support tickets o bytoch** | ? | -50% |
| **Invoices with wrong addresses** | ? | <2% |
| **IBAN validation errors** | >0 | 0 |

### QA Checklist

- [ ] All 4 wizard steps работают bez errors
- [ ] IBAN validation works SK/CZ
- [ ] Address lookup returns accurate results
- [ ] BIC auto-fill works
- [ ] PDF download works + feedback visible
- [ ] Apartment edit/delete works
- [ ] All fields required/optional clearly marked
- [ ] Mobile responsive (wizard steps fit)
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] User can complete wizard in <5 min

---

## 9. PRIDAL NOTES

### Bezpečnosť
- PDF kódy: jedinečné per byt, nemoženosť guess
- IBAN: nikdy nelogguj v plain text (log len masked IBAN xxxx0000)
- Billing editovanie: audit trail (kto, kedy, čo sa zmenilo)

### Performance
- Address lookup: cache výsledky (Redis) aby sme neslali 10x rovnaký request
- IBAN validation: lokálne (bez API call)
- BIC lookup: cache tabuľka (load pri startup)

### Lokalizácia
- SK/CZ obe krajiny — obe adresy lookup, IBAN formáty, terény polí
- CZ: "SVJ" miesto "SVB", "ČNBS" miesto "NBS", atď.

### Stavy a State Management
- Persistence wizardu: `localStorage['floory.onboarding.${userId}']`
- Session timeout: keď user naposledy interakuje — obnoviť session

---

## 10. ZÁVER

Floory onboarding je funčný, ale **bez editovania bytov a bez validácie dát**. Priorita je:

1. **Byty editor** — bez toho sú importy nepoužiteľné
2. **IBAN validator** — bez toho faktúry s chybnými účtami
3. **PDF sprievodca** — bez toho user nevie čo s kódmi robiť
4. **Address lookup** — bez toho sú adresy nesprávne

**Timeline:** 4 týždne (1-2 týždne P1, 1 týždeň P2, ostatné P3/P4)

**Očakávaný výsledok:** "Top 1 app na SVK" — profresional setup bez zmatkov, s guidance a bez chýb.

---

**Prepared by:** Claude Opus  
**Date:** 2026-04-26  
**Version:** 1.0 (Analysis Phase)
