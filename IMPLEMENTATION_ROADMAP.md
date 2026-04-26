# Floory Onboarding — Detailná implementačná roadmap

## 🎯 FÁZA 1: Kritické opravy (Týždeň 1-2)

### 1.1 Apartment Editor — Krok 2 Vylepšenie

**Popis:** Po importe XLSX sa zobrazia byty v tabuľke s možnosťou editovať, odstrániť a pridať nové ručne.

**Súčasný stav:**
```
Step 2: Byty a vlastníci
- Upload XLSX ✓
- Import result summary ✓
- [Pokračovať →]
```

**Cieľový stav:**
```
Step 2: Byty a vlastníci  
- Upload XLSX ✓
- Import result summary ✓
- [Apartment Table]
  | Byt | Vlastník | Email | Podiele | Akcie |
  | 01  | John Doe | ... | 1.000 | Edit, Delete |
  | 02  | Jane Doe | ... | 1.000 | Edit, Delete |
  | Add apartment manually...
- [Pokračovať →]
```

**Nové komponenty:**
- `ApartmentTable.tsx` — tabuľka s inline buttons
- `ApartmentEditor.tsx` — modal form (add/edit)
- `ApartmentDeleteConfirm.tsx` — confirmation dialog

**Backend zmeny:**
- `PATCH /buildings/:id/apartments/:aptId` — update byt
- `DELETE /buildings/:id/apartments/:aptId` — delete byt
- `POST /buildings/:id/apartments` — create nový

**Frontend zmeny:**
- `apps/web/src/App.tsx` Step 2 — import ApartmentTable
- State: `[apartments, setApartments]` — po importe naplní, user može editovať
- Validácia: unitNumber musí byť unique v buildings

**Odhadovaný čas:** 2-3 dni

---

### 1.2 IBAN Validator — Krok 3 Vylepšenie

**Popis:** IBAN input s automatickým formátovaním (`SK00 0000 0000 0000 0000 0000`) a validáciou (MOD97).

**Súčasný stav:**
```
IBAN: [                    ] (text input bez formátovania)
```

**Cieľový stav:**
```
IBAN: [SK00 0000 0000 0000 0000 0000] ✓
      └─ Vaša banka je: Tatra banka, a.s.
      └─ BIC: TATRSKBX (auto-filled)
```

**Nové komponenty:**
- `IbanInput.tsx` — input s formatter + validator
- `BicDisplay.tsx` — zobrazenie BIC (readonly, auto-filled)

**Backend utility:**
- `apps/api/src/utilities/iban.service.ts`:
  - `formatIban(str)` — normalizácia
  - `validateIban(str)` — MOD97 check
  - `lookupBicByIban(iban)` — SK/CZ BIC registry

**Frontend zmeny:**
- `apps/web/src/App.tsx` Step 3 — import IbanInput
- Real-time validation: error message keď je IBAN neplatný
- On blur: call lookupBicByIban, auto-fill BIC field

**Validácia:**
- Dĺžka: SK=24, CZ=24 (ISO 13616)
- Prefix: SK/CZ + 2 čísla + 4 čísla (kód banky)
- MOD97 kontrolný súčet

**Odhadovaný čas:** 2-3 dni

---

### 1.3 PDF Activation Codes — Step 4 Sprievodca

**Popis:** Step 4 sa zmení z statického na interaktívny sprievodca s viacerými krokami.

**Súčasný stav:**
```
Step 4: Hotovo 🎉
Budova XYZ je pripravená.
[Aktivačné kódy (PDF)] [Prejsť do budovy →]
```

**Cieľový stav:**
```
Step 4a: Prehľad
- Budova "Hviezdoslavova 12" ✓
- Vytvorené byty: 12 ✓
- Súčet podielov: 12.000 ✓
[Pokračovať →]

Step 4b: Byty
[Apartment Table — čítateľný len]
| Byt | Vlastník | Email | Kód |
| 01  | John Doe | ... | DBF-A1234 |
| ... |
[← Späť] [Pokračovať →]

Step 4c: Vygenerovať kódy
- "Vygenerujete 12 aktivačných kódov"
[Vygenerovať kódy] (button s loading state)
[← Späť] [Pokračovať →]

Step 4d: PDF Download
- "PDF s aktivačnými kódmi je pripravený"
[Stiahnúť PDF]
[← Späť] [Dokončiť →]

Step 4e: Doručenie
- "Ako doručiť kódy vlastníkom?"
  () Vytlačiť PDF a fyzicky doručiť
  () Poslať emaily
  () Poslať SMS (ak máte phone)
[← Späť] [Pokračovať →]

Step 4f: Ďakujeme!
- "Budova je pripravená"
- [Prejsť do budovy →]
```

**Nové komponenty:**
- `ActivationCodesWizard.tsx` — main component
- `ActivationCodesStep1.tsx` — overview
- `ActivationCodesStep2.tsx` — table
- ... Step3-6
- `ActivationCodesPdfPreview.tsx` — inline PDF viewer
- `ActivationCodesDeliveryForm.tsx` — email/sms form

**Backend zmeny:**
- `POST /buildings/:id/activation-codes/generate` — vygenerovať kódy
- `GET /buildings/:id/apartments?include=codes` — get byty s kódmi
- `POST /buildings/:id/activation-codes/send-email` — mass email

**Frontend zmeny:**
- `apps/web/src/App.tsx` Step 4 — replace s ActivationCodesWizard
- State machine: `step = 4a | 4b | 4c | 4d | 4e | 4f`
- Loading states: generating, downloading, sending

**Odhadovaný čas:** 3-4 dni

---

### 1.4 Address Lookup — Krok 1 Vylepšenie

**Popis:** Address input s autocomplete a normalizáciou adresy.

**Súčasný stav:**
```
Adresa: [                    ] (text input)
```

**Cieľový stav:**
```
Adresa: [H        |  Hviezdoslavova 12 |]
         |        |  Halásmová 45      |
         |        |  Hálova 123        |
         └────────────────────────────┘
        ✓ Hviezdoslavova 12
        201 Bratislava
        SK-811 02
```

**Nové komponenty:**
- `AddressInput.tsx` — input + dropdown
- `AddressLookupService.ts` — API proxy + caching

**API zdroje:**
- OpenStreetMap Nominatim API (free, no auth)
- Fallback: MapBox Geocoding (ak máme API key)

**Backend utility:**
- `apps/api/src/utilities/address.service.ts`:
  - `lookupAddress(query, country)` — hit Nominatim, normalize
  - Response: `{ address, city, zip, displayName }`

**Frontend zmeny:**
- `apps/web/src/App.tsx` Step 1 — import AddressInput
- Real-time search na `onInput`
- Debounce: 300ms (aby sme neslali 10 requestov za sekundu)
- Cache: localStorage aby sa zľahčili requesty

**Validácia:**
- Adresa je povinná
- PSČ musí byť 5 číslic SK / 3-5 CZ

**Odhadovaný čas:** 2-3 dni

---

## 🟠 FÁZA 2: UX Vylepšenia (Týždeň 3)

### 2.1 BIC Auto-lookup

**Popis:** Keď user zadá IBAN, automaticky sa vyhľadá BIC a zavyznamená banka.

**Implementácia:**
- BIC lookup table v Backend:
  ```
  SK:
  - TATRSKBX: Tatra banka
  - OTPVSKBX: OTP Banka
  - UNCRSKBX: Unicredit
  ...
  CZ:
  - GIBACZPX: Česká spořitelna
  ...
  ```
- Frontend: IbanInput na blur → API call `/api/bic/lookup?iban=SK...`
- Auto-fill BIC field + show "Vaša banka je: X"

**Odhadovaný čas:** 1 deň

---

### 2.2 Building Settings Page

**Popis:** Nová stránka `/b/:id/nastavenia` na edit budovy údajov.

**Tabs:**
1. **Základné** — name, address, ico, legalForm (editovať len CHAIRMAN)
2. **Fakturačné** — billingName, IČO, DIČ, IČ DPH, adresa, IBAN, BIC (editovať len MANAGER)
3. **Email** — šablóny pre faktúry, upozornenia (editovať CHAIRMAN/MANAGER)
4. **Audit log** — tabuľka zmien (readonly)

**Authorization:**
- CHAIRMAN: view all, edit General + Email
- MANAGER: view all, edit all
- ADMIN: view all (no edit, iba na admin portáli)
- OWNER: view only

**Nové komponenty:**
- `BuildingSettingsPage.tsx` — main
- `BuildingGeneralTab.tsx`
- `BuildingBillingTab.tsx`
- `BuildingEmailTab.tsx`
- `AuditLogTable.tsx`

**Backend zmeny:**
- `PATCH /buildings/:id` — update general
- `PATCH /buildings/:id/billing` — update billing
- `PATCH /buildings/:id/email-templates` — update templates
- `GET /buildings/:id/audit` — get audit log

**Frontend zmeny:**
- `apps/web/src/shells/ChairmanShell.tsx` — add route `/b/:id/nastavenia`

**Odhadovaný čas:** 3-4 dni

---

### 2.3 In-App Onboarding (Sprievodca)

**Popis:** Tooltips a mini-tutorial pri prvej návševe.

**Steps:**
1. "Vitajte v Floory — aplikácia na správu bytových domov"
2. "Role: Predseda vedí SVB, Správca spravuje finančne, Vlastník vidí faktúry"
3. "Základné funkcie: Faktúry, Hlasovania, Byty, Poruchy"
4. "Čo ďalej? Vytvorte prvé hlasovanie alebo pošlite faktúry vlastníkom"
5. Link na Knowledge Base (FAQ, user manual)

**Tech:**
- `useOnboarding` hook — track current step, mark completed
- `OnboardingTooltips.tsx` — render tooltips
- Persistence: localStorage `floory.onboarding.${userId}.completed`

**Nástroj:**
- Custom tooltips (bez heavy library ako Joyride)
- Alebo: Joyride (23 KB gzipped)

**Odhadovaný čas:** 1-2 dni

---

## 🟡 FÁZA 3: Polish (Týždeň 4+)

### 3.1 Wizard State Persistence

**Popis:** Keď user naviguje preč z onboarding a vráti sa, stav sa zachová.

**Implementácia:**
- localStorage: `floory.wizard.${buildingId}` = JSON (step, form state)
- Na load: if `localStorage` exists && building == same → restore state

**Odhadovaný čas:** 1 deň

---

### 3.2 Form Sections + Tooltips

**Popis:** Krok 3 sa rozdelí na logické sekcie, každé pole má info icon.

**Sekcie:**
- "Základné" — Názov, IČO
- "Daňové" — DIČ, IČ DPH
- "Adresa a bankové údaje" — Adresa, IBAN, BIC
- "Pätička" — poznámky

**Tooltips:**
- "IČ DPH" → "Ak ste registrovaní na DPH, zadajte identifikačné číslo"
- "Zápis v registri" → "Napr. 'Okresný úrad Bratislava III, OPS-2010/123'"
- atď.

**Odhadovaný čas:** 2 dni

---

### 3.3 Invoice Preview (Real-time Mockup)

**Popis:** Vpravo od Step 3 form se zobrazí mockup faktúry s live previewom údajov.

**Layout:**
```
Left: Form (30%)          Right: Invoice Preview (70%)
                          ┌──────────────────┐
Názov SVB          ────→  │ FLOORY            │
IČO 12345678              │ Hviezdoslavova 12 │
DIČ 2023456789      ──→   │ 811 02 Bratislava │
IBAN SK00 0000      ────→ │ IČO: 12345678     │
...                       │ DIČ: 2023456789   │
                          │ IBAN: SK00 0000   │
                          │ BIC: TATRSKBX     │
```

**Odhadovaný čas:** 2 dni

---

## 📊 TIMELINE SUMMARY

```
Week 1   │ ████████ │ Apartment Editor + IBAN Validator
Week 2   │ ████████ │ PDF Sprievodca + Address Lookup
Week 3   │ ██████   │ BIC Auto-lookup + Settings Page + In-App Onboarding
Week 4   │ ████     │ State Persistence + Form Polish + Invoice Preview
```

**Total:** 4 weeks, ~100-120 hours

---

## ✅ QA CHECKLIST

### Desktop (1920×1080)
- [ ] Step 1 — address lookup works
- [ ] Step 2 — apartment table editable
- [ ] Step 3 — IBAN validates + BIC fills
- [ ] Step 4 — PDF download shows progress + success
- [ ] No layout issues, form wraps correctly

### Mobile (375×812)
- [ ] Wizard steps fit screen
- [ ] Buttons accessible, no overlap
- [ ] Address dropdown doesn't overflow
- [ ] PDF preview scrollable
- [ ] Touch targets ≥44px

### Accessibility
- [ ] ARIA labels on all inputs
- [ ] Keyboard navigation (Tab, Enter, Esc)
- [ ] Focus indicators visible
- [ ] Color contrast ≥4.5:1

### Security
- [ ] IBAN masked in logs (xxxx0000)
- [ ] Audit trail recorded
- [ ] Authorization checks on API
- [ ] No sensitive data in localStorage

### Performance
- [ ] Address lookup: <500ms
- [ ] IBAN validation: instant
- [ ] PDF generation: <2s
- [ ] No memory leaks

---

## 🎬 LAUNCH CHECKLIST

- [ ] All P1 tasks completed
- [ ] QA passed on desktop + mobile
- [ ] Documentation updated
- [ ] User guide / Knowledge Base updated
- [ ] Support team briefed
- [ ] Deploy to production
- [ ] Monitor error logs for 24h

---

## 📝 NOTES

### Data Migration (if needed)
- Existing buildings: auto-fill BillingBic field from lookup if empty
- Existing apartments: no changes needed

### Backwards Compatibility
- Old IBAN format still accepted (without spaces)
- API changes: additive only (no breaking changes)

### Future Enhancements
- SMS activation codes delivery
- QR code generator for codes
- Multi-language settings per user
- Custom email templates editor UI

---

Prepared by: Claude Opus  
Date: 2026-04-26  
Status: Ready for Development
