import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api, apiUpload, clearTokens, getAccessToken, setTokens } from './api';
import { I18nContext, Locale, translate, useT } from './i18n';
import { MarketingPage } from './marketing/Marketing';
import { ResidentShell } from './shells/ResidentShell';
import { ChairmanShell } from './shells/ChairmanShell';
import { ManagerShell } from './shells/ManagerShell';
import { ActivatePage } from './shells/ActivatePage';
import type { Me } from './types';
import { CommandPalette } from './components/CommandPalette';
import { BuildingSwitcher } from './components/BuildingSwitcher';
import { Avatar } from './components/Avatar';
import { RoleGateway } from './components/RoleGateway';
import { AuthRoleStrip } from './components/AuthRoleStrip';
import { NotFoundPage } from './components/ErrorBoundary';
import { TermsPage, PrivacyPage, DpaPage } from './legal/LegalPages';
import { StatusPage, ChangelogPage } from './legal/StatusAndChangelog';
import { MarketingMenu } from './marketing/MarketingMenu';
import { PhonePairUploadPage } from './shells/PhonePairUploadPage';
import { FlooryLogo } from './components/FlooryLogo';
import { IcoLookupHint } from './components/IcoLookup';
import { CompanyNameSearch } from './components/CompanyNameSearch';
import type { RegistryResult } from './hooks/useIcoLookup';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Vlastník',
  CHAIRMAN: 'Predseda',
  MANAGER: 'Správca',
  MAINTENANCE: 'Údržba',
  ADMIN: 'Administrátor',
};

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState<Locale>(() => {
    const stored = localStorage.getItem('dp.locale') as Locale | null;
    return stored === 'SK' || stored === 'CS' ? stored : 'SK';
  });

  useEffect(() => {
    document.documentElement.lang = locale === 'CS' ? 'cs' : 'sk';
    localStorage.setItem('dp.locale', locale);
  }, [locale]);

  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    api<Me>('/users/me')
      .then((u) => {
        setMe(u);
        if (u.locale === 'SK' || u.locale === 'CS') setLocale(u.locale);
      })
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="auth-shell">
        <p className="inline-meta">Načítavam…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <I18nContext.Provider value={locale}>
        <Topbar />
        <Routes>
          <Route path="/" element={<MarketingPage />} />
          <Route path="/prihlasenie" element={<Login onLogin={setMe} />} />
          <Route path="/registracia" element={<AdminRegister onLoggedIn={setMe} />} />
          <Route path="/aktivacia" element={<ActivatePage onLoggedIn={setMe} />} />
          <Route path="/aktivacia/:code" element={<ActivatePage onLoggedIn={setMe} />} />
          <Route path="/r/:code" element={<ActivatePage onLoggedIn={setMe} />} />
          <Route path="/p/:token" element={<PhonePairUploadPage />} />
          <Route path="/obchodne-podmienky" element={<TermsPage />} />
          <Route path="/ochrana-udajov" element={<PrivacyPage />} />
          <Route path="/spracovanie-udajov" element={<DpaPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </I18nContext.Provider>
    );
  }

  // Role-based shell dispatcher:
  //   - Žiadne membership + onboarding flow → wizard vytvorí budovu
  //   - Predseda / správca / admin → ChairmanShell (detail budovy)
  //   - Len vlastník → ResidentShell (minimalistický dashboard)
  const primary = pickPrimaryBuilding(me);

  return (
    <I18nContext.Provider value={locale}>
      <Topbar me={me} />
      <Routes>
        {/* Onboarding wizard — keď admin nemá budovu */}
        <Route path="/onboarding" element={<Onboarding me={me} onDone={setMe} />} />

        {/* Resident shell */}
        <Route path="/moj-dom/*" element={<ResidentShell me={me} />} />

        {/* Chairman shell — jedna budova, všetky sekcie */}
        <Route path="/b/:buildingId/*" element={<ChairmanShell me={me} />} />

        {/* Manager shell — multi-building portfólio (správcovská firma / admin) */}
        <Route path="/admin/*" element={<ManagerShell me={me} />} />

        {/* Backwards compat: /building/:id → /b/:id */}
        <Route path="/building/:buildingId" element={<LegacyBuildingRedirect />} />

        {/* Account settings (cross-shell) */}
        <Route path="/nastavenia" element={<main className="shell-main" id="main" tabIndex={-1}><AccountSettings /></main>} />

        {/* Legal + public pages accessible aj pre prihlásených */}
        <Route path="/obchodne-podmienky" element={<TermsPage />} />
        <Route path="/ochrana-udajov" element={<PrivacyPage />} />
        <Route path="/spracovanie-udajov" element={<DpaPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/p/:token" element={<PhonePairUploadPage />} />

        {/* Root → smart redirect */}
        <Route path="/" element={<RootRedirect me={me} primary={primary} />} />
        <Route path="*" element={<RootRedirect me={me} primary={primary} />} />
      </Routes>
    </I18nContext.Provider>
  );
}

function pickPrimaryBuilding(me: Me): { kind: 'manager' | 'chairman' | 'resident' | 'none'; buildingId?: string } {
  const adminMemberships = me.memberships.filter((m) =>
    ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
  );
  const uniqueBuildings = Array.from(new Set(adminMemberships.map((m) => m.building.id)));
  if (uniqueBuildings.length >= 2) return { kind: 'manager' };
  if (uniqueBuildings.length === 1) return { kind: 'chairman', buildingId: uniqueBuildings[0] };
  const owner = me.memberships.find((m) => m.role === 'OWNER');
  if (owner) return { kind: 'resident', buildingId: owner.building.id };
  return { kind: 'none' };
}

function RootRedirect({ me, primary }: { me: Me; primary: ReturnType<typeof pickPrimaryBuilding> }) {
  if (primary.kind === 'none') return <Navigate to="/onboarding" replace />;
  if (primary.kind === 'manager') return <Navigate to="/admin" replace />;
  if (primary.kind === 'chairman') return <Navigate to={`/b/${primary.buildingId}`} replace />;
  return <Navigate to="/moj-dom/domov" replace />;
}

function LegacyBuildingRedirect() {
  const { buildingId } = useParams<{ buildingId: string }>();
  return <Navigate to={`/b/${buildingId}`} replace />;
}

/* ------------------------------------------------------------------- */
/*  Topbar                                                              */
/* ------------------------------------------------------------------- */

function Topbar({ me }: { me?: Me }) {
  const t = useT();
  function activeBuildingId(): string | undefined {
    const m = /^\/b\/([^/]+)/.exec(location.pathname);
    return m?.[1];
  }
  const isOnMarketing = !me && location.pathname === '/';

  return (
    <header className="topbar" role="banner">
      {me && <MobileMenu me={me} />}
      <Link to="/" className="brand brand-floory" aria-label="Floory — domov">
        <FlooryLogo size={26} />
      </Link>
      {isOnMarketing && <MarketingMenu />}
      <div className="row topbar-actions">
        {me && <BuildingSwitcher me={me} />}
        {me && <CommandPalette me={me} buildingId={activeBuildingId()} />}
        {me && <NotificationBell />}
        {me ? (
          <div className="user-chip" aria-label="Prihlásený používateľ">
            <Link to="/nastavenia" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar name={`${me.firstName} ${me.lastName}`} email={me.email} size={28} />
              <span className="long">
                <strong>{me.firstName} {me.lastName}</strong>
              </span>
            </Link>
            <button
              className="secondary"
              onClick={() => {
                clearTokens();
                location.href = '/';
              }}
            >
              {t('nav.logout')}
            </button>
          </div>
        ) : (
          <>
            <Link to="/prihlasenie" className="btn-link secondary">
              Prihlásenie
            </Link>
            <Link to="/registracia" className="btn-link primary">
              Registrovať
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

/* ---------------- Mobile drawer menu ---------------- */

function MobileMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  // URL-driven: pick building-scoped vs resident links
  const isBuilding = /^\/b\/([^/]+)/.exec(location.pathname);
  const isResident = location.pathname.startsWith('/moj-dom');
  const bId = isBuilding?.[1] ?? me.memberships.find((m) => ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role))?.building.id;

  const chairmanLinks = bId ? [
    { to: `/b/${bId}`, label: '🏠 Prehľad' },
    { to: `/b/${bId}/hlasovania`, label: '🗳️ Hlasovania' },
    { to: `/b/${bId}/poruchy`, label: '🔧 Poruchy' },
    { to: `/b/${bId}/schodze`, label: '📅 Schôdze' },
    { to: `/b/${bId}/oznamy`, label: '📢 Oznamy' },
    { to: `/b/${bId}/platby`, label: '💸 Platby' },
    { to: `/b/${bId}/revizie`, label: '🛠️ Revízie' },
    { to: `/b/${bId}/byty`, label: '🏢 Byty' },
    { to: `/b/${bId}/burza`, label: '🏘️ Burza' },
    { to: `/b/${bId}/nastavenia`, label: '⚙️ Nastavenia budovy' },
  ] : [];
  const residentLinks = [
    { to: '/moj-dom/domov', label: '🏠 Prehľad' },
    { to: '/moj-dom/faktury', label: '💸 Faktúry' },
    { to: '/moj-dom/oznamy', label: '📢 Oznamy' },
    { to: '/moj-dom/schodze', label: '📅 Schôdze' },
    { to: '/moj-dom/poruchy/nova', label: '🔧 Nahlásiť poruchu' },
    { to: '/moj-dom/burza', label: '🏘️ Burza' },
  ];
  const links = isResident ? residentLinks : chairmanLinks;

  return (
    <>
      <button type="button" className="hamburger" onClick={() => setOpen(true)} aria-label="Otvoriť menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
      </button>
      {open && (
        <div className="mobile-drawer" onClick={() => setOpen(false)}>
          <div className="mobile-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '0.5rem 0.75rem 1rem' }}>
              <strong style={{ fontSize: 18 }}>DomovPlus</strong>
            </div>
            <ul className="shell-nav" onClick={() => setOpen(false)}>
              {links.map((l) => (
                <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
              ))}
              <li className="shell-nav-group">Účet</li>
              <li><Link to="/nastavenia">⚙️ Nastavenia účtu</Link></li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------- */
/*  Login                                                               */
/* ------------------------------------------------------------------- */

function Login({ onLogin }: { onLogin: (me: Me) => void }) {
  const [email, setEmail] = useState('predseda@domovplus.local');
  const [password, setPassword] = useState('DemoHeslo12345!');
  const [totpToken, setTotpToken] = useState('');
  const [mfaNeeded, setMfaNeeded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const body: Record<string, string> = { email, password };
      if (totpToken) body.totpToken = totpToken;
      const res = await api<{ accessToken?: string; refreshToken?: string; mfaRequired?: boolean }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(body) },
      );
      if (res.mfaRequired) {
        setMfaNeeded(true);
        return;
      }
      if (res.accessToken && res.refreshToken) {
        setTokens(res.accessToken, res.refreshToken);
        const me = await api<Me>('/users/me');
        onLogin(me);
        // ?next=/aktivacia/... — bounced sem z activation pre email konflikt
        const next = new URLSearchParams(location.search).get('next');
        navigate(next && next.startsWith('/') ? next : '/', { replace: true });
      }
    } catch (e) {
      setErr('Nesprávne prihlasovacie údaje. Skúste znova.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card" role="main">
        <AuthRoleStrip />
        <h1>Vitajte späť</h1>
        <p className="lede">Prihláste sa do vášho bytového domu.</p>
        <form onSubmit={submit} noValidate>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Heslo
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {mfaNeeded && (
            <label>
              Overovací kód (6 číslic)
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                required
              />
              <span className="hint">Zadajte kód z vašej autentifikačnej aplikácie.</span>
            </label>
          )}
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Prihlasujem…' : 'Prihlásiť sa'}
          </button>
          {err && (
            <p role="alert" style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>
              {err}
            </p>
          )}
        </form>
        <div className="demo-hint">
          Demo účet · <code>predseda@domovplus.local</code> / <code>DemoHeslo12345!</code>
        </div>
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--brand-soft)', borderRadius: 8, textAlign: 'center' }}>
          <strong>Dostali ste aktivačný kód?</strong>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4 }}>
            Napríklad od predsedu SVB alebo správcu.
          </div>
          <Link to="/aktivacia" className="ui-btn ui-btn-primary" style={{ marginTop: 8 }}>
            Aktivovať účet kódom →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- */
/*  Admin register — krok 1 onboardingu                                 */
/* ------------------------------------------------------------------- */

function AdminRegister({ onLoggedIn }: { onLoggedIn: (me: Me) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await api<{ accessToken: string; refreshToken: string }>(
        '/auth/register-admin',
        {
          method: 'POST',
          body: JSON.stringify({ email, password, firstName, lastName }),
        },
      );
      setTokens(res.accessToken, res.refreshToken);
      const me = await api<Me>('/users/me');
      onLoggedIn(me);
      navigate('/onboarding');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card" role="main">
        <AuthRoleStrip />
        <h1>Vytvoriť účet správcu</h1>
        <p className="lede">
          Založíme si účet. V ďalšom kroku vytvoríte prvú budovu a nahráte byty.
        </p>
        <div style={{ padding: '0.625rem 0.875rem', background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 8, marginBottom: '1rem', fontSize: 13 }}>
          <strong>Pozor:</strong> Toto je pre <em>nových</em> predsedov/správcov, ktorí začínajú budovu od nuly.
          Ak ste dostali aktivačný kód od existujúceho predsedu, použite radšej{' '}
          <Link to="/aktivacia">aktiváciu kódom</Link>.
        </div>
        <form onSubmit={submit} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label>
              Meno
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </label>
            <label>
              Priezvisko
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </label>
          </div>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Heslo (minimálne 10 znakov)
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Vytváram účet…' : 'Pokračovať'}
          </button>
          {err && (
            <p role="alert" style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>
              {err}
            </p>
          )}
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--fg-muted)' }}>
          Máte už účet? <Link to="/prihlasenie">Prihlásiť sa</Link>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- */
/*  Onboarding wizard (po registrácii admina)                           */
/* ------------------------------------------------------------------- */

function Onboarding({ me, onDone }: { me: Me; onDone: (me: Me) => void }) {
  const navigate = useNavigate();
  // Onboarding wizard vždy začína v Step 1 (vytvoriť novú budovu) — či už je to
  // prvý admin alebo existujúci správca pridávajúci ďalšiu budovu.
  // `building` (cieľ importu bytov) sa naplní až potom, čo wizard budovu vytvorí.
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(1);
  const [building, setBuilding] = useState<any | null>(null);
  const [billing, setBilling] = useState({
    billingName: '',
    billingIco: '',
    billingDic: '',
    billingVatId: '',
    billingAddress: '',
    billingIban: '',
    billingBic: '',
    billingBankName: '',
    billingRegistry: '',
    invoiceFooterNote: '',
  });
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingErr, setBillingErr] = useState<string | null>(null);
  const [icoApplied, setIcoApplied] = useState(false);

  function applyRegistryToBilling(r: RegistryResult) {
    setBilling((b) => ({
      ...b,
      billingName: r.name ?? b.billingName,
      billingDic: r.dic ?? b.billingDic,
      billingVatId: r.vatId ?? b.billingVatId,
      billingAddress: r.address ?? b.billingAddress,
      billingRegistry: r.registry ?? b.billingRegistry,
    }));
    setIcoApplied(true);
  }

  async function submitBilling(e: React.FormEvent) {
    e.preventDefault();
    if (!building) return;
    setBillingBusy(true); setBillingErr(null);
    try {
      const updated = await api<any>(`/buildings/${building.id}/billing`, {
        method: 'PATCH',
        body: JSON.stringify(billing),
      });
      setBuilding(updated);
      setStep(4);
    } catch (e) {
      setBillingErr((e as Error).message);
    } finally {
      setBillingBusy(false);
    }
  }
  const hasExisting = me.memberships.some((m) =>
    ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
  );
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    zip: '',
    country: 'SK',
    legalForm: 'SVB',
    ico: '',
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submitBuilding(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const b = await api<any>('/buildings', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setBuilding(b);
      // refresh me so topbar + sidebar have new memberships
      const me2 = await api<Me>('/users/me');
      onDone(me2);
      setStep(2);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    if (!building) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await apiUpload<ImportResult>(
        `/buildings/${building.id}/import-apartments`,
        file,
      );
      setImportResult(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function downloadBlob(path: string, filename: string) {
    const token = localStorage.getItem('domovplus.accessToken');
    const res = await fetch(`/api${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setErr(`Sťahovanie zlyhalo (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <WizardStepper step={step} />
      {step === 1 && (
        <section className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
          <div className="row" style={{ marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>
              {hasExisting ? 'Pridať novú budovu' : 'Krok 1 — Základné údaje budovy'}
            </h2>
            <span className="spacer" />
            {hasExisting && (
              <button
                type="button"
                className="ui-btn ui-btn-ghost"
                onClick={() => navigate(-1)}
                style={{ minHeight: 32, padding: '0 10px', fontSize: 13 }}
              >
                ← Zrušiť
              </button>
            )}
          </div>
          <p>
            {hasExisting
              ? 'Tieto údaje uvidia vlastníci tejto budovy v zápisniciach, faktúrach a oznamoch.'
              : 'Tieto údaje sa objavia v zápisniciach z hlasovaní a faktúrach.'}
          </p>
          <form onSubmit={submitBuilding}>
            <label>
              Názov budovy
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="napr. Bytový dom Hviezdoslavova 12"
                required
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
              <label>
                Adresa
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required
                />
              </label>
              <label>
                Mesto
                <input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                />
              </label>
              <label>
                PSČ
                <input
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  required
                />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <label>
                Krajina
                <select
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                >
                  <option value="SK">Slovensko</option>
                  <option value="CZ">Česká republika</option>
                </select>
              </label>
              <label>
                Právna forma
                <select
                  value={form.legalForm}
                  onChange={(e) => setForm({ ...form, legalForm: e.target.value })}
                >
                  <option value="SVB">SVB (SK)</option>
                  <option value="BD">Bytové družstvo (SK)</option>
                  <option value="SVJ">SVJ (CZ)</option>
                </select>
              </label>
              <label>
                IČO
                <input
                  value={form.ico}
                  onChange={(e) => setForm({ ...form, ico: e.target.value })}
                  placeholder="voliteľné"
                />
              </label>
            </div>
            <button type="submit" disabled={busy}>
              {busy ? 'Zakladám…' : 'Pokračovať na byty →'}
            </button>
            {err && (
              <p role="alert" style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>
                {err}
              </p>
            )}
          </form>
        </section>
      )}

      {step === 2 && building && (
        <section className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2>Krok 2 — Byty a vlastníci</h2>
          <p>
            Nahrajte Excel so zoznamom bytov. Pre každý byt sa vygeneruje aktivačný kód, ktorý
            doručíte vlastníkovi (napr. vytlačený v schránke).
          </p>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button onClick={() => fileInput.current?.click()} disabled={busy}>
              <UploadIcon size={16} /> {busy ? 'Importujem…' : 'Nahrať .xlsx'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
              }}
            />
            <button
              className="secondary"
              onClick={() =>
                downloadBlob('/buildings/import/template.xlsx', 'domovplus-byty-sablona.xlsx')
              }
            >
              <DownloadIcon size={16} /> Stiahnuť šablónu
            </button>
          </div>

          {importResult && (
            <div style={{ marginTop: '1rem' }}>
              <div className="row">
                <span className="tag ok">
                  <CheckIcon size={12} /> Vytvorených: {importResult.created}
                </span>
                {importResult.skipped > 0 && (
                  <span className="tag">Preskočené: {importResult.skipped}</span>
                )}
                {importResult.errors.length > 0 && (
                  <span className="tag err">Chyby: {importResult.errors.length}</span>
                )}
              </div>
              {importResult.errors.length > 0 && (
                <details style={{ marginTop: '0.75rem' }}>
                  <summary>Zobraziť chyby ({importResult.errors.length})</summary>
                  <ul>
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="inline-meta">
                        Riadok {e.row}
                        {e.unitNumber ? ` (byt ${e.unitNumber})` : ''}: {e.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <hr />
          <div className="row">
            <button className="ghost" onClick={() => setStep(1)}>
              ← Späť
            </button>
            <span className="spacer" />
            <button onClick={() => {
              // Fakturačné údaje sú nezávislé od názvu budovy — predseda môže byť SVB,
              // ktoré spravuje viacero budov. Prefill iba ak má budova IČO (vtedy je to
              // dosť pravdepodobne tá istá entita).
              if (building.ico) {
                setBilling((b) => ({ ...b, billingIco: b.billingIco || (building.ico ?? '') }));
              }
              setStep(3);
            }}>Pokračovať →</button>
          </div>
          {err && (
            <p role="alert" style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>
              {err}
            </p>
          )}
        </section>
      )}

      {step === 3 && building && (
        <section className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2>Krok 3 — Fakturačné údaje SVB / správcu</h2>
          <p>
            Tieto údaje patria <strong>vám ako fakturujúcej entite</strong> (SVB, BD, správcovská firma) —
            <strong>nemusia byť rovnaké ako názov budovy</strong>. Ak spravujete viac budov, tieto údaje sa
            uložia ku každej budove samostatne (môžete ich pri ďalšej budove zopakovať alebo zmeniť).
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginTop: '-0.5rem' }}>
            Najrýchlejší spôsob: zadajte <strong>IČO</strong> nižšie — meno, DIČ, IČ DPH a adresa sa doplnia z RPO automaticky.
          </p>
          <form onSubmit={submitBilling}>
            <label>
              Názov SVB / BD / správcu na faktúre <span style={{ color: 'var(--urgent)' }}>*</span>
              <input
                required
                value={billing.billingName}
                onChange={(e) => setBilling({ ...billing, billingName: e.target.value })}
                placeholder="napr. SVB Hviezdoslavova 12 / Správa, s. r. o."
                autoComplete="off"
              />
              <CompanyNameSearch
                query={billing.billingName}
                country="SK"
                onPick={(r) => {
                  setBilling((b) => ({
                    ...b,
                    billingName: r.name ?? b.billingName,
                    billingIco: r.ico ?? b.billingIco,
                    billingDic: r.dic ?? b.billingDic,
                    billingVatId: r.vatId ?? b.billingVatId,
                    billingAddress: r.address ?? b.billingAddress,
                    billingRegistry: r.registry ?? b.billingRegistry,
                  }));
                  if (r.ico) setIcoApplied(true);
                }}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <label>
                IČO <span style={{ color: 'var(--urgent)' }}>*</span>
                <input
                  required
                  value={billing.billingIco}
                  onChange={(e) => { setBilling({ ...billing, billingIco: e.target.value }); setIcoApplied(false); }}
                  placeholder="12345678"
                  inputMode="numeric"
                  maxLength={8}
                />
              </label>
              <label>
                DIČ
                <input value={billing.billingDic} onChange={(e) => setBilling({ ...billing, billingDic: e.target.value })} placeholder="2023456789" />
              </label>
              <label>
                IČ DPH (ak ste platca)
                <input value={billing.billingVatId} onChange={(e) => setBilling({ ...billing, billingVatId: e.target.value })} placeholder="SK2023456789" />
              </label>
            </div>
            {/* IcoLookupHint na celom rade pod IČO trojstĺpcom */}
            <IcoLookupHint
              ico={billing.billingIco}
              country={building.country === 'CZ' ? 'CZ' : 'SK'}
              onApply={applyRegistryToBilling}
              applied={icoApplied}
            />
            <label>
              Fakturačná adresa <span style={{ color: 'var(--urgent)' }}>*</span>
              <input required value={billing.billingAddress} onChange={(e) => setBilling({ ...billing, billingAddress: e.target.value })} placeholder="Hviezdoslavova 12, 811 02 Bratislava" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <label>
                IBAN <span style={{ color: 'var(--urgent)' }}>*</span>
                <input
                  required
                  value={billing.billingIban}
                  onChange={(e) => setBilling({ ...billing, billingIban: e.target.value })}
                  placeholder="SK00 0000 0000 0000 0000 0000"
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                />
              </label>
              <label>
                BIC / SWIFT
                <input value={billing.billingBic} onChange={(e) => setBilling({ ...billing, billingBic: e.target.value })} placeholder="napr. TATRSKBX" />
              </label>
            </div>
            <label>
              Banka (názov)
              <input value={billing.billingBankName} onChange={(e) => setBilling({ ...billing, billingBankName: e.target.value })} placeholder="napr. Tatra banka, a.s." />
            </label>
            <label>
              Zápis v registri
              <input value={billing.billingRegistry} onChange={(e) => setBilling({ ...billing, billingRegistry: e.target.value })} placeholder="napr. Okresný úrad Bratislava III, č. OPS-2010/123" />
            </label>
            <label>
              Pätička faktúry
              <textarea
                rows={2}
                value={billing.invoiceFooterNote}
                onChange={(e) => setBilling({ ...billing, invoiceFooterNote: e.target.value })}
                placeholder="napr. „SVB nie je platcom DPH. Ďakujeme za úhradu."
              />
            </label>
            <hr />
            <div className="row">
              <button type="button" className="ghost" onClick={() => setStep(2)}>
                ← Späť
              </button>
              <span className="spacer" />
              <button type="button" className="secondary" onClick={() => setStep(4)}>
                Vyplniť neskôr
              </button>
              <button type="submit" disabled={billingBusy}>
                {billingBusy ? 'Ukladám…' : 'Uložiť a dokončiť →'}
              </button>
            </div>
            {billingErr && (
              <p role="alert" style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>
                {billingErr}
              </p>
            )}
          </form>
        </section>
      )}

      {step === 4 && building && (
        <section className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2>Hotovo 🎉</h2>
          <p>
            Budova <strong>{building.name}</strong> je pripravená. Vytlačte aktivačné kódy a
            doručte ich vlastníkom — následne sa môžu registrovať.
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              onClick={() =>
                downloadBlob(
                  `/buildings/${building.id}/activation-codes.pdf`,
                  `domovplus-kody-${building.id.slice(0, 8)}.pdf`,
                )
              }
            >
              <PrintIcon size={16} /> Aktivačné kódy (PDF)
            </button>
            <button className="secondary" onClick={() => navigate(`/building/${building.id}`)}>
              Prejsť do budovy →
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function WizardStepper({ step }: { step: 0 | 1 | 2 | 3 | 4 }) {
  const steps = ['Registrácia', 'Budova', 'Byty', 'Fakturácia', 'Hotovo'];
  return (
    <div className="row" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
      {steps.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={label} className="row" style={{ gap: '0.5rem' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                background: done ? 'var(--brand)' : active ? 'var(--brand-soft)' : 'var(--surface-2)',
                color: done ? 'var(--brand-on)' : active ? 'var(--brand)' : 'var(--fg-subtle)',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              {done ? <CheckIcon size={14} /> : i}
            </div>
            <span style={{ color: active ? 'var(--fg)' : 'var(--fg-muted)', fontWeight: active ? 600 : 400 }}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <span style={{ width: 32, height: 2, background: 'var(--border)', margin: '0 0.5rem' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- */
/*  Dashboard                                                           */
/* ------------------------------------------------------------------- */

function Dashboard({ me }: { me: Me }) {
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting =
    hour < 11 ? 'Dobré ráno' : hour < 18 ? 'Dobrý deň' : 'Dobrý večer';

  return (
    <>
      <h1>
        {greeting}, {me.firstName}.
      </h1>
      <p>Vyberte si budovu, ktorú chcete spravovať alebo si pozrieť.</p>

      <h2>Vaše budovy</h2>
      {me.memberships.length === 0 ? (
        <div className="empty">
          <BuildingIcon size={40} />
          <h3>Zatiaľ žiadna budova</h3>
          <p>Požiadajte správcu o aktivačný kód z vyúčtovania.</p>
        </div>
      ) : (
        <div className="grid">
          {me.memberships.map((m) => (
            <button
              key={m.building.id + m.role}
              type="button"
              className="card interactive"
              onClick={() => navigate(`/building/${m.building.id}`)}
              style={{ textAlign: 'left', background: 'var(--surface)', color: 'var(--fg)' }}
            >
              <div className="card-title-row">
                <h3>{m.building.name}</h3>
                <span className="tag info">{ROLE_LABEL[m.role] ?? m.role}</span>
              </div>
              <p className="inline-meta">
                <LocationIcon size={14} /> {m.building.city}
                {m.apartment && (
                  <>
                    <span className="sep">·</span>byt {m.apartment.unitNumber}
                  </>
                )}
              </p>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------- */
/*  Building detail                                                     */
/* ------------------------------------------------------------------- */

function Building({ me }: { me: Me }) {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [votings, setVotings] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [balance, setBalance] = useState<{ outstanding: string; unpaidCount: number } | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const myMembership = me.memberships.find((m) => m.building.id === buildingId);
  const isAdmin = !!myMembership && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(myMembership.role);
  const myApartmentId = myMembership?.apartment?.id ?? null;

  useEffect(() => {
    if (!buildingId) return;
    const base: Array<Promise<any>> = [
      api<any[]>(`/voting/building/${buildingId}`).catch(() => []),
      api<any[]>(`/announcements/feed`).catch(() => []),
      api<any[]>(`/tickets/building/${buildingId}`).catch(() => []),
      api<any[]>(`/meetings/building/${buildingId}`).catch(() => []),
    ];
    const apartmentExtras: Array<Promise<any>> = myApartmentId
      ? [
          api<any[]>(`/finance/apartment/${myApartmentId}/invoices`).catch(() => []),
          api<{ outstanding: string; unpaidCount: number }>(
            `/finance/apartment/${myApartmentId}/balance`,
          ).catch(() => null),
        ]
      : [Promise.resolve([]), Promise.resolve(null)];

    Promise.all([...base, ...apartmentExtras]).then(([v, a, t, m, inv, bal]) => {
      setVotings(v);
      setAnnouncements(a);
      setTickets(t);
      setMeetings(m);
      setInvoices(inv);
      setBalance(bal);
      setLoaded(true);
    });
  }, [buildingId, myApartmentId]);

  return (
    <>
      <button className="ghost" onClick={() => navigate('/')} style={{ marginBottom: '0.5rem' }}>
        ← Späť
      </button>
      <h1>Moja budova</h1>
      <p>Prehľad hlasovaní, oznamov a porúch.</p>

      {isAdmin && buildingId && <AdminSection buildingId={buildingId} />}
      {isAdmin && buildingId && <AdminStatsCard buildingId={buildingId} />}

      {myApartmentId && balance && (
        <BalanceCard balance={balance} invoiceCount={invoices.length} />
      )}

      {myApartmentId && <PaymentHistoryChart apartmentId={myApartmentId} />}

      <section aria-labelledby="votings-h">
        <h2 id="votings-h">
          <VoteIcon size={18} /> Hlasovania
        </h2>
        {!loaded ? (
          <p className="inline-meta">Načítavam…</p>
        ) : votings.length === 0 ? (
          <div className="empty">
            <VoteIcon size={36} />
            <h3>Žiadne aktívne hlasovanie</h3>
            <p>Keď predseda vytvorí hlasovanie, zobrazí sa tu.</p>
          </div>
        ) : (
          <div className="stack">
            {votings.map((v) => (
              <div key={v.id} className="card">
                <div className="card-title-row">
                  <h3>{v.title}</h3>
                  <VotingStatusTag voting={v} />
                </div>
                <p>{v.description}</p>
                <p className="inline-meta">
                  Typ: {v.type} <span className="sep">·</span> Uzávierka:{' '}
                  {new Date(v.closesAt).toLocaleString('sk-SK', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {v.result && (
                  <p style={{ marginTop: '0.75rem' }}>
                    <span className={'tag ' + (v.result.accepted ? 'ok' : 'err')}>
                      <span className="dot" aria-hidden="true"></span>
                      {v.result.accepted ? 'PRIJATÉ' : 'ZAMIETNUTÉ'}
                    </span>{' '}
                    <span className="tag">
                      Kvórum {v.result.quorumReached ? 'dosiahnuté' : 'nedosiahnuté'}
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="announcements-h">
        <h2 id="announcements-h">
          <BellIcon size={18} /> Nástenka
        </h2>
        {!loaded ? (
          <p className="inline-meta">Načítavam…</p>
        ) : announcements.length === 0 ? (
          <div className="empty">
            <BellIcon size={36} />
            <h3>Žiadne nové oznamy</h3>
            <p>Tu sa zobrazia informácie o odstávkach a udalostiach.</p>
          </div>
        ) : (
          <div className="stack">
            {announcements.map((r: any) => (
              <div key={r.id} className="card">
                <div className="card-title-row">
                  <h3>{r.announcement.title}</h3>
                  <SeverityTag severity={r.announcement.severity} />
                </div>
                <p>{r.announcement.body}</p>
                <div className="row">
                  {r.readAt ? (
                    <span className="tag ok">
                      <CheckIcon size={12} /> Prečítané
                    </span>
                  ) : (
                    <button
                      onClick={async () => {
                        await api(`/announcements/receipts/${r.id}/read`, { method: 'PATCH' });
                        setAnnouncements((prev) =>
                          prev.map((x) =>
                            x.id === r.id ? { ...x, readAt: new Date().toISOString() } : x,
                          ),
                        );
                      }}
                    >
                      <CheckIcon size={16} /> Potvrdiť prečítanie
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {myApartmentId && <InvoicesSection invoices={invoices} loaded={loaded} />}

      <MeetingsSection meetings={meetings} loaded={loaded} isAdmin={isAdmin} />

      {buildingId && <RevisionsSection buildingId={buildingId} isAdmin={isAdmin} />}

      {buildingId && <ClassifiedsSection buildingId={buildingId} />}


      <section aria-labelledby="tickets-h">
        <h2 id="tickets-h">
          <WrenchIcon size={18} /> Poruchy
        </h2>
        {!loaded ? (
          <p className="inline-meta">Načítavam…</p>
        ) : tickets.length === 0 ? (
          <div className="empty">
            <WrenchIcon size={36} />
            <h3>Žiadne nahlásené poruchy</h3>
            <p>Všetko funguje. Ak niečo nie je v poriadku, môžete to nahlásiť v mobilnej aplikácii.</p>
          </div>
        ) : (
          <div className="stack">
            {tickets.map((t) => (
              <div key={t.id} className="card">
                <div className="card-title-row">
                  <h3>{t.title}</h3>
                  <TicketStatusTag status={t.status} />
                </div>
                <p>{t.description}</p>
                <p className="inline-meta">
                  Priorita: {t.priority}
                  {t.apartment && (
                    <>
                      <span className="sep">·</span>byt {t.apartment.unitNumber}
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------- */
/*  Helpers: status tags & icons                                        */
/* ------------------------------------------------------------------- */

/* ------------------------------------------------------------------- */
/*  Invoices section — zoznam + QR modal                                 */
/* ------------------------------------------------------------------- */

function InvoicesSection({ invoices, loaded }: { invoices: any[]; loaded: boolean }) {
  const t = useT();
  const [qr, setQr] = useState<{ dataUrl: string; iban: string; reference: string; amount: string } | null>(null);
  const [qrBusyId, setQrBusyId] = useState<string | null>(null);

  async function openQr(invoiceId: string) {
    setQrBusyId(invoiceId);
    try {
      const r = await api<any>(`/finance/invoices/${invoiceId}/qr`);
      setQr(r);
    } finally {
      setQrBusyId(null);
    }
  }

  return (
    <section aria-labelledby="invoices-h">
      <h2 id="invoices-h">
        <InvoiceIcon size={18} /> {t('invoices.title')}
      </h2>
      {!loaded ? (
        <p className="inline-meta">Načítavam…</p>
      ) : invoices.length === 0 ? (
        <div className="empty">
          <InvoiceIcon size={36} />
          <h3>{t('invoices.empty.title')}</h3>
          <p>{t('invoices.empty.body')}</p>
        </div>
      ) : (
        <div className="stack">
          {invoices.map((inv) => (
            <div key={inv.id} className="card">
              <div className="card-title-row">
                <h3>{invoiceCategoryLabel(inv.category)} · {inv.period}</h3>
                <InvoiceStatusTag status={inv.status} />
              </div>
              <p className="inline-meta">
                Č. {inv.number} <span className="sep">·</span> splatnosť{' '}
                {new Date(inv.dueDate).toLocaleDateString('sk-SK')}
              </p>
              <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0.5rem 0 0' }}>
                {Number(inv.amount).toFixed(2)} {inv.currency}
              </p>
              {inv.note && <p className="inline-meta">{inv.note}</p>}
              {(inv.status === 'DUE' || inv.status === 'OVERDUE') && (
                <div className="row" style={{ marginTop: '0.75rem' }}>
                  <button className="secondary" disabled={qrBusyId === inv.id} onClick={() => openQr(inv.id)}>
                    <QrIcon size={16} /> {qrBusyId === inv.id ? '…' : t('invoices.showQr')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {qr && <QrModal qr={qr} onClose={() => setQr(null)} />}
    </section>
  );
}

function QrModal({ qr, onClose }: { qr: { dataUrl: string; iban: string; reference: string; amount: string }; onClose: () => void }) {
  const t = useT();
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 360, textAlign: 'center', padding: '1.5rem' }}
      >
        <h3 style={{ marginBottom: '0.25rem' }}>{t('invoices.showQr')}</h3>
        <p className="inline-meta" style={{ marginBottom: '1rem' }}>
          {t('invoices.qrHint')}
        </p>
        <img
          src={qr.dataUrl}
          alt="SEPA EPC QR"
          style={{ width: '100%', maxWidth: 280, display: 'block', margin: '0 auto', borderRadius: 'var(--radius-md)' }}
        />
        <dl style={{ marginTop: '1rem', fontSize: '0.9375rem' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <dt className="inline-meta">IBAN</dt>
            <dd style={{ fontFamily: 'ui-monospace, monospace', margin: 0 }}>{qr.iban}</dd>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <dt className="inline-meta">VS</dt>
            <dd style={{ fontFamily: 'ui-monospace, monospace', margin: 0 }}>{qr.reference}</dd>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <dt className="inline-meta">Suma</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{Number(qr.amount).toFixed(2)} EUR</dd>
          </div>
        </dl>
        <button onClick={onClose} style={{ marginTop: '1rem', width: '100%' }}>
          {t('invoices.closeQr')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- */
/*  Meetings section                                                     */
/* ------------------------------------------------------------------- */

function MeetingsSection({ meetings, loaded, isAdmin }: { meetings: any[]; loaded: boolean; isAdmin: boolean }) {
  const t = useT();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function uploadMinutes(meetingId: string, file: File) {
    await apiUpload(`/meetings/${meetingId}/minutes`, file);
    location.reload();
  }

  async function downloadMinutes(meetingId: string) {
    const r = await api<{ url: string }>(`/meetings/${meetingId}/minutes/download`);
    window.open(r.url, '_blank', 'noopener');
  }

  return (
    <section aria-labelledby="meetings-h">
      <h2 id="meetings-h">
        <CalendarIcon size={18} /> {t('meetings.title')}
      </h2>
      {!loaded ? (
        <p className="inline-meta">Načítavam…</p>
      ) : meetings.length === 0 ? (
        <div className="empty">
          <CalendarIcon size={36} />
          <h3>{t('meetings.empty.title')}</h3>
          <p>{t('meetings.empty.body')}</p>
        </div>
      ) : (
        <div className="stack">
          {meetings.map((m) => (
            <div key={m.id} className="card">
              <div className="card-title-row">
                <h3>{m.title}</h3>
                <MeetingStatusTag status={m.status} />
              </div>
              <p className="inline-meta">
                📅{' '}
                {new Date(m.scheduledAt).toLocaleString('sk-SK', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {m.location && (
                  <>
                    <span className="sep">·</span>📍 {m.location}
                  </>
                )}
              </p>
              <details style={{ marginTop: '0.5rem' }}>
                <summary>{t('meetings.agenda')}</summary>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    color: 'var(--fg-muted)',
                    fontSize: '0.9375rem',
                    marginTop: '0.5rem',
                  }}
                >
                  {m.agenda}
                </pre>
              </details>
              <div className="row" style={{ marginTop: '0.75rem' }}>
                {m.minutesPdfKey && (
                  <button className="secondary" onClick={() => downloadMinutes(m.id)}>
                    <DownloadIcon size={16} /> {t('meetings.downloadMinutes')}
                  </button>
                )}
                {isAdmin && (
                  <>
                    <button className="secondary" onClick={() => fileInputs.current[m.id]?.click()}>
                      <UploadIcon size={16} /> {t('meetings.uploadMinutes')}
                    </button>
                    <input
                      ref={(el) => {
                        fileInputs.current[m.id] = el;
                      }}
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadMinutes(m.id, f);
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- */
/*  Balance card — prehľad zostatku vlastníka                            */
/* ------------------------------------------------------------------- */

function BalanceCard({
  balance,
  invoiceCount,
}: {
  balance: { outstanding: string; unpaidCount: number };
  invoiceCount: number;
}) {
  const outstanding = Number(balance.outstanding);
  const positive = outstanding > 0;
  return (
    <section
      aria-labelledby="balance-h"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}
    >
      <div
        className="card"
        style={{
          background: positive
            ? 'linear-gradient(135deg, var(--danger-soft), var(--surface))'
            : 'linear-gradient(135deg, var(--success-soft), var(--surface))',
        }}
      >
        <p className="inline-meta" id="balance-h">
          {positive ? 'Nedoplatok' : 'Bez nedoplatku'}
        </p>
        <p
          style={{
            fontSize: '1.875rem',
            fontWeight: 700,
            margin: '0.25rem 0 0',
            color: positive ? 'var(--danger)' : 'var(--success)',
          }}
        >
          {outstanding.toFixed(2)} €
        </p>
        <p className="inline-meta">
          {balance.unpaidCount > 0
            ? `${balance.unpaidCount} neuhradených faktúr`
            : 'Všetky faktúry zaplatené'}
        </p>
      </div>
      <div className="card">
        <p className="inline-meta">Celkovo faktúr</p>
        <p style={{ fontSize: '1.875rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
          {invoiceCount}
        </p>
        <p className="inline-meta">Vrátane zaplatených</p>
      </div>
    </section>
  );
}

function invoiceCategoryLabel(c: string): string {
  const map: Record<string, string> = {
    MAINTENANCE_FUND: 'Fond opráv',
    SERVICES: 'Zálohy na služby',
    MANAGEMENT_FEE: 'Odmena správcu',
    ONE_TIME: 'Mimoriadna platba',
    OTHER: 'Ostatné',
  };
  return map[c] ?? c;
}

function InvoiceStatusTag({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    DUE: ['warn', 'Neuhradená'],
    PAID: ['ok', 'Zaplatená'],
    OVERDUE: ['err', 'Po splatnosti'],
    CANCELLED: ['', 'Zrušená'],
  };
  const [cls, label] = map[status] ?? ['', status];
  return <span className={`tag ${cls}`}>{label}</span>;
}

function MeetingStatusTag({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    SCHEDULED: ['info', 'Naplánovaná'],
    COMPLETED: ['ok', 'Uskutočnená'],
    CANCELLED: ['err', 'Zrušená'],
  };
  const [cls, label] = map[status] ?? ['', status];
  return <span className={`tag ${cls}`}>{label}</span>;
}

/* ------------------------------------------------------------------- */
/*  Admin section — import bytov z Excelu, PDF aktivačných kódov        */
/* ------------------------------------------------------------------- */

interface ImportResult {
  created: number;
  skipped: number;
  codesIssued: number;
  errors: Array<{ row: number; unitNumber?: string; message: string }>;
  rows: Array<{ unitNumber: string; activationCode: string }>;
}

function AdminStatsCard({ buildingId }: { buildingId: string }) {
  const t = useT();
  const [stats, setStats] = useState<any | null>(null);
  useEffect(() => {
    api<any>(`/buildings/${buildingId}/admin-stats`).then(setStats).catch(() => {});
  }, [buildingId]);
  if (!stats) return null;
  const tiles = [
    {
      label: t('admin.stats.apartments'),
      value: `${stats.registeredOwners}/${stats.apartmentsCount}`,
      sub: `${Math.round(stats.registrationRate * 100)}% registrovaných`,
    },
    {
      label: t('admin.stats.openTickets'),
      value: stats.openTickets,
      sub: stats.openTickets === 0 ? 'Nič aktívne' : 'V riešení',
    },
    {
      label: t('admin.stats.outstanding'),
      value: `${Number(stats.outstandingTotalEur).toFixed(2)} €`,
      sub: 'Všetky neuhradené',
    },
  ];
  return (
    <section
      aria-label="Admin stats"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}
    >
      {tiles.map((x) => (
        <div key={x.label} className="card" style={{ padding: '1rem' }}>
          <p className="inline-meta">{x.label}</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0' }}>{x.value}</p>
          <p className="inline-meta">{x.sub}</p>
        </div>
      ))}
    </section>
  );
}

function AdminSection({ buildingId }: { buildingId: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [bankResult, setBankResult] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bankInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setErr(null);
    setResult(null);
    setBusy(true);
    try {
      const r = await apiUpload<ImportResult>(`/buildings/${buildingId}/import-apartments`, file);
      setResult(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleBankCsv(file: File) {
    setErr(null);
    setBankResult(null);
    setBusy(true);
    try {
      const r = await apiUpload<any>(`/finance/bank-import/${buildingId}`, file);
      setBankResult(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (bankInput.current) bankInput.current.value = '';
    }
  }

  async function downloadBlob(path: string, filename: string) {
    const token = localStorage.getItem('domovplus.accessToken');
    const res = await fetch(`/api${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setErr(`Sťahovanie zlyhalo (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      aria-labelledby="admin-h"
      style={{
        padding: '1.25rem',
        marginBottom: '2rem',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(180deg, var(--brand-soft), var(--surface))',
      }}
    >
      <div className="row" style={{ marginBottom: '0.5rem' }}>
        <h2 id="admin-h" style={{ margin: 0 }}>
          <ToolIcon size={18} /> Správa budovy
        </h2>
        <span className="spacer" />
        <span className="tag info">
          <span className="dot" /> Admin
        </span>
      </div>
      <p>
        Nahrajte zoznam bytov z Excelu. Pre každý byt sa automaticky vygeneruje aktivačný kód pre
        vlastníka — ten si ho uplatní pri registrácii.
      </p>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          <UploadIcon size={16} /> {busy ? 'Importujem…' : 'Nahrať .xlsx'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button
          type="button"
          className="secondary"
          onClick={() =>
            downloadBlob('/buildings/import/template.xlsx', 'domovplus-byty-sablona.xlsx')
          }
        >
          <DownloadIcon size={16} /> Šablóna (.xlsx)
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            downloadBlob(
              `/buildings/${buildingId}/activation-codes.pdf`,
              `domovplus-kody-${buildingId.slice(0, 8)}.pdf`,
            )
          }
        >
          <PrintIcon size={16} /> Aktivačné kódy (PDF)
        </button>
      </div>

      {err && (
        <p role="alert" style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>
          {err}
        </p>
      )}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <div className="row">
            <span className="tag ok">
              <CheckIcon size={12} /> Vytvorených: {result.created}
            </span>
            {result.skipped > 0 && (
              <span className="tag">Preskočené (existujú): {result.skipped}</span>
            )}
            {result.errors.length > 0 && (
              <span className="tag err">Chyby: {result.errors.length}</span>
            )}
          </div>
          {result.errors.length > 0 && (
            <details style={{ marginTop: '0.75rem' }}>
              <summary>Zobraziť chyby</summary>
              <ul>
                {result.errors.map((e, i) => (
                  <li key={i} className="inline-meta">
                    Riadok {e.row}
                    {e.unitNumber ? ` (byt ${e.unitNumber})` : ''}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.rows.length > 0 && (
            <p className="inline-meta" style={{ marginTop: '0.75rem' }}>
              Tip: kliknite na „Aktivačné kódy (PDF)" a vytlačte zoznam pre vlastníkov.
            </p>
          )}
        </div>
      )}

      <p className="inline-meta" style={{ marginTop: '1rem' }}>
        Očakávané stĺpce: <code>unitNumber</code>, <code>floor</code>, <code>area</code>,{' '}
        <code>ownershipShare</code>. Akceptované sú aj slovenské názvy (<code>byt</code>,{' '}
        <code>poschodie</code>, <code>plocha</code>, <code>podiel</code>).
      </p>

      <hr />
      <h3 style={{ marginTop: 0 }}>{t('admin.bankImport')}</h3>
      <p className="inline-meta">
        CSV z banky · stĺpce <code>paidAt;amount;reference;note</code>. Riadky so správnym
        <code> reference </code> sa spárujú s faktúrou a označia PAID.
      </p>
      <div className="row">
        <button className="secondary" onClick={() => bankInput.current?.click()} disabled={busy}>
          <UploadIcon size={16} /> CSV výpis
        </button>
        <input
          ref={bankInput}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleBankCsv(f);
          }}
        />
      </div>
      {bankResult && (
        <div className="row" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <span className="tag ok">
            <CheckIcon size={12} /> {t('admin.bankMatched', { n: bankResult.matched })}
          </span>
          {bankResult.unmatched > 0 && (
            <span className="tag warn">{t('admin.bankUnmatched', { n: bankResult.unmatched })}</span>
          )}
          {bankResult.errors?.length > 0 && (
            <span className="tag err">{t('admin.errorsCount', { n: bankResult.errors.length })}</span>
          )}
        </div>
      )}
    </section>
  );
}

function VotingStatusTag({ voting }: { voting: any }) {
  if (voting.status === 'OPEN') return <span className="tag info"><span className="dot" /> Prebieha</span>;
  if (voting.status === 'DRAFT') return <span className="tag">Pripravené</span>;
  if (voting.status === 'CANCELLED') return <span className="tag err">Zrušené</span>;
  if (voting.result?.accepted) return <span className="tag ok">Prijaté</span>;
  if (voting.status === 'CLOSED') return <span className="tag">Uzavreté</span>;
  return <span className="tag">{voting.status}</span>;
}

function SeverityTag({ severity }: { severity: string }) {
  if (severity === 'URGENT') return <span className="tag err"><span className="dot" /> Urgentné</span>;
  if (severity === 'WARNING') return <span className="tag warn">Upozornenie</span>;
  return <span className="tag info">Informácia</span>;
}

function TicketStatusTag({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    OPEN: ['err', 'Otvorené'],
    IN_PROGRESS: ['warn', 'V riešení'],
    WAITING: ['warn', 'Čaká'],
    RESOLVED: ['ok', 'Vyriešené'],
    CLOSED: ['', 'Uzavreté'],
  };
  const [cls, label] = map[status] ?? ['', status];
  return <span className={`tag ${cls}`}>{label}</span>;
}

/* Inline SVG ikony — žiadna závislosť, škálujú sa podľa CSS */

function HomeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function BuildingIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-4h4v4" />
    </svg>
  );
}

function LocationIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 4 }}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function VoteIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }}>
      <path d="m9 12 2 2 4-4" />
      <path d="M5 7h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
      <path d="M16 3v4M8 3v4" />
    </svg>
  );
}

function BellIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function WrenchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }}>
      <path d="M14.7 6.3a4 4 0 0 0-5.3 5.3L3 18l3 3 6.4-6.4a4 4 0 0 0 5.3-5.3l-2.3 2.3-2-2z" />
    </svg>
  );
}

function TextIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7V5h16v2M9 5v14M5 19h8" />
      <path d="M15 13h6M18 10v10" />
    </svg>
  );
}

/* ------------------------------------------------------------------- */
/*  Notification bell                                                    */
/* ------------------------------------------------------------------- */

function NotificationBell() {
  const [feed, setFeed] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const unread = feed.filter((r) => !r.readAt).length;

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const f = await api<any[]>('/announcements/feed');
        if (alive) setFeed(f);
      } catch {}
    }
    poll();
    const id = setInterval(poll, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  async function markRead(id: string) {
    try {
      await api(`/announcements/receipts/${id}/read`, { method: 'PATCH' });
      setFeed((f) => f.map((r) => (r.id === id ? { ...r, readAt: new Date().toISOString() } : r)));
    } catch {}
  }

  function openFull() {
    setOpen(false);
    // Resident navigates to /moj-dom/oznamy; chairman (if present) also works if feed has items
    navigate('/moj-dom/oznamy');
  }

  const preview = feed.slice(0, 5);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={`Oznamy: ${unread} neprečítaných`}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          minHeight: 40,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 999,
          background: 'transparent',
          border: '1px solid transparent',
          color: 'var(--fg-muted)',
          cursor: 'pointer',
        }}
      >
        <BellIcon size={20} />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: 'var(--urgent)',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="bell-menu" role="menu">
          <div className="bell-head">
            <strong>Oznamy</strong>
            {unread > 0 && <span className="inline-meta">{unread} neprečítaných</span>}
          </div>
          {preview.length === 0 ? (
            <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--fg-subtle)' }}>
              Žiadne oznamy.
            </div>
          ) : (
            preview.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`bell-item ${r.readAt ? '' : 'unread'}`}
                onClick={async () => {
                  if (!r.readAt) await markRead(r.id);
                  openFull();
                }}
              >
                <div className="bell-title">
                  {!r.readAt && <span className="bell-dot" aria-hidden="true" />}
                  {r.announcement.title}
                </div>
                <div className="bell-body">{r.announcement.body.slice(0, 100)}</div>
                <div className="bell-time">{new Date(r.announcement.publishedAt).toLocaleDateString('sk-SK')}</div>
              </button>
            ))
          )}
          <div className="bell-foot">
            <button type="button" className="bs-link" onClick={openFull} style={{ textAlign: 'center', width: '100%' }}>
              Zobraziť všetky oznamy →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- */
/*  Account settings (sessions, 2FA recovery, GDPR, push)                */
/* ------------------------------------------------------------------- */

function AccountSettings() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api<any[]>('/auth/sessions').then(setSessions).catch(() => {});
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((r) =>
        r.pushManager.getSubscription().then((s) => setPushEnabled(!!s)),
      );
    }
  }, []);

  async function revoke(id: string) {
    await api(`/auth/sessions/${id}`, { method: 'DELETE' });
    setSessions((s) => s.filter((x) => x.id !== id));
  }

  async function genRecovery() {
    const r = await api<{ codes: string[] }>('/auth/totp/recovery-codes', { method: 'POST' });
    setRecoveryCodes(r.codes);
  }

  async function exportGdpr() {
    const data = await api<any>('/auth/gdpr/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `domovplus-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (!confirm('Naozaj chcete zmazať svoj účet? Túto akciu nie je možné vrátiť späť.')) return;
    await api('/auth/gdpr/delete', { method: 'DELETE' });
    clearTokens();
    location.href = '/';
  }

  async function togglePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMsg('Tento prehliadač nepodporuje push notifikácie.');
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    if (pushEnabled) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setPushEnabled(false);
      return;
    }
    const { publicKey } = await api<{ publicKey: string }>('/push/public-key');
    if (!publicKey) {
      setMsg('Server nemá nakonfigurované VAPID kľúče — push notifikácie zatiaľ nedostupné.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setMsg('Notifikácie neboli povolené.');
      return;
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(publicKey) as BufferSource,
    });
    await api('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(sub.getKey('p256dh')),
          auth: arrayBufferToBase64(sub.getKey('auth')),
        },
      }),
    });
    setPushEnabled(true);
  }

  return (
    <>
      <button className="ghost" onClick={() => navigate('/')}>← Späť</button>
      <h1>Nastavenia účtu</h1>

      <section>
        <h2>🔔 Push notifikácie</h2>
        <p>Dostanete upozornenie na nové oznamy, hlasovania, pripomienky revízií — aj keď máte appku zatvorenú.</p>
        <button onClick={togglePush} className={pushEnabled ? 'secondary' : undefined}>
          {pushEnabled ? 'Vypnúť push' : 'Zapnúť push notifikácie'}
        </button>
        {msg && <p className="inline-meta" style={{ marginTop: '0.5rem' }}>{msg}</p>}
      </section>

      <section>
        <h2>💻 Aktívne prihlásenia</h2>
        <p>Zoznam zariadení a prehliadačov, ktoré majú prístup k vášmu účtu.</p>
        <div className="stack">
          {sessions.length === 0 && <p className="inline-meta">Len toto zariadenie.</p>}
          {sessions.map((s) => (
            <div key={s.id} className="card">
              <div className="card-title-row">
                <h3>{s.userAgent ?? 'Neznáme zariadenie'}</h3>
                <button className="secondary" onClick={() => revoke(s.id)}>Odhlásiť</button>
              </div>
              <p className="inline-meta">
                IP: {s.ipAddress ?? '—'} · prihlásené{' '}
                {new Date(s.createdAt).toLocaleString('sk-SK')}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>🔐 Záložné kódy pre 2FA</h2>
        <p>
          Ak stratíte telefón, každý z 10 kódov sa dá jednorazovo použiť namiesto TOTP. Každé
          vygenerovanie neplatí predošlé kódy.
        </p>
        {recoveryCodes ? (
          <div className="card" style={{ background: 'var(--warning-soft)' }}>
            <h3 style={{ color: 'var(--warning)' }}>Uložte si tieto kódy — už ich neuvidíte!</h3>
            <ul style={{ columnCount: 2, fontFamily: 'ui-monospace, monospace', fontSize: '1.125rem' }}>
              {recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : (
          <button onClick={genRecovery}>Vygenerovať 10 záložných kódov</button>
        )}
      </section>

      <section>
        <h2>📦 GDPR — vaše dáta</h2>
        <p>Podľa článku 20 máte právo na prenositeľnosť, podľa článku 17 na výmaz.</p>
        <div className="row">
          <button onClick={exportGdpr}>Stiahnuť moje dáta (JSON)</button>
          <button className="danger" onClick={deleteAccount}>Zmazať účet</button>
        </div>
      </section>
    </>
  );
}

function urlB64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/* ------------------------------------------------------------------- */
/*  Revisions section                                                    */
/* ------------------------------------------------------------------- */

function RevisionsSection({ buildingId, isAdmin }: { buildingId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: 'ELEVATOR',
    title: '',
    dueDate: '',
    intervalMonths: '',
    contractorName: '',
    contractorPhone: '',
  });

  useEffect(() => {
    api<any[]>(`/revisions/building/${buildingId}`).then(setItems).catch(() => {});
  }, [buildingId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const created = await api<any>('/revisions', {
      method: 'POST',
      body: JSON.stringify({
        buildingId,
        type: form.type,
        title: form.title,
        dueDate: new Date(form.dueDate).toISOString(),
        intervalMonths: form.intervalMonths ? Number(form.intervalMonths) : undefined,
        contractorName: form.contractorName || undefined,
        contractorPhone: form.contractorPhone || undefined,
      }),
    });
    setItems((s) => [...s, created].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
    setShowForm(false);
    setForm({ ...form, title: '', dueDate: '' });
  }

  async function complete(id: string) {
    const done = await api<any>(`/revisions/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ completedAt: new Date().toISOString() }),
    });
    setItems((s) => s.map((r) => (r.id === id ? done : r)));
  }

  return (
    <section aria-labelledby="rev-h">
      <div className="row">
        <h2 id="rev-h" style={{ margin: 0 }}>
          🔧 Revízie a preventívna údržba
        </h2>
        <span className="spacer" />
        {isAdmin && (
          <button className="secondary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Zavrieť' : 'Pridať revíziu'}
          </button>
        )}
      </div>
      {showForm && isAdmin && (
        <form onSubmit={create} className="card" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label>
              Typ
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="BOILER">Kotol / plyn. zariadenia</option>
                <option value="ELEVATOR">Výťah</option>
                <option value="CHIMNEY">Kominárske</option>
                <option value="ELECTRICAL">Elektroinštalácia</option>
                <option value="FIRE_SAFETY">Požiarna</option>
                <option value="GAS">Plynovod</option>
                <option value="LIGHTNING_ROD">Bleskozvod</option>
                <option value="PLAYGROUND">Detské ihrisko</option>
                <option value="OTHER">Iné</option>
              </select>
            </label>
            <label>
              Názov
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="napr. Úradná skúška výťahu" />
            </label>
            <label>
              Splatnosť
              <input type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </label>
            <label>
              Interval (mesiace)
              <input type="number" min={1} value={form.intervalMonths} onChange={(e) => setForm({ ...form, intervalMonths: e.target.value })} placeholder="36" />
            </label>
            <label>
              Dodávateľ
              <input value={form.contractorName} onChange={(e) => setForm({ ...form, contractorName: e.target.value })} placeholder="Schindler SK" />
            </label>
            <label>
              Telefón
              <input value={form.contractorPhone} onChange={(e) => setForm({ ...form, contractorPhone: e.target.value })} placeholder="+421 …" />
            </label>
          </div>
          <button type="submit">Uložiť revíziu</button>
        </form>
      )}
      {items.length === 0 ? (
        <div className="empty" style={{ marginTop: '1rem' }}>
          <h3>Žiadne naplánované revízie</h3>
          <p>Pridajte zákonne povinné kontroly kotla, výťahu, bleskozvodu a pod.</p>
        </div>
      ) : (
        <div className="stack">
          {items.map((r) => {
            const days = Math.round((new Date(r.dueDate).getTime() - Date.now()) / 86400_000);
            const urgent = !r.completedAt && days <= 30;
            const overdue = !r.completedAt && days < 0;
            return (
              <div key={r.id} className="card">
                <div className="card-title-row">
                  <h3>{r.title}</h3>
                  {r.completedAt ? (
                    <span className="tag ok">Hotové</span>
                  ) : overdue ? (
                    <span className="tag err">Po splatnosti · {-days} dní</span>
                  ) : urgent ? (
                    <span className="tag warn">Splatné o {days} dní</span>
                  ) : (
                    <span className="tag">Splatné o {days} dní</span>
                  )}
                </div>
                <p className="inline-meta">
                  {revisionTypeLabel(r.type)} <span className="sep">·</span>{' '}
                  {new Date(r.dueDate).toLocaleDateString('sk-SK')}
                  {r.contractorName && <> <span className="sep">·</span> {r.contractorName} {r.contractorPhone}</>}
                </p>
                {!r.completedAt && isAdmin && (
                  <div className="row" style={{ marginTop: '0.5rem' }}>
                    <button className="secondary" onClick={() => complete(r.id)}>Označiť ako hotové</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function revisionTypeLabel(t: string): string {
  const map: Record<string, string> = {
    BOILER: 'Kotol',
    ELEVATOR: 'Výťah',
    CHIMNEY: 'Kominárske',
    ELECTRICAL: 'Elektroinštalácia',
    FIRE_SAFETY: 'Požiarna',
    GAS: 'Plynovod',
    LIGHTNING_ROD: 'Bleskozvod',
    PLAYGROUND: 'Detské ihrisko',
    OTHER: 'Iné',
  };
  return map[t] ?? t;
}

/* ------------------------------------------------------------------- */
/*  Classifieds / burza                                                  */
/* ------------------------------------------------------------------- */

function ClassifiedsSection({ buildingId }: { buildingId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: 'FOR_SALE',
    title: '',
    body: '',
    priceEur: '',
    contactPhone: '',
    contactApartment: '',
  });

  async function load() {
    const r = await api<any[]>(`/classifieds/building/${buildingId}`);
    setItems(r);
  }
  useEffect(() => { load(); }, [buildingId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api('/classifieds', {
      method: 'POST',
      body: JSON.stringify({
        buildingId,
        ...form,
        priceEur: form.priceEur || undefined,
        contactPhone: form.contactPhone || undefined,
        contactApartment: form.contactApartment || undefined,
      }),
    });
    setShowForm(false);
    setForm({ ...form, title: '', body: '', priceEur: '' });
    await load();
  }

  return (
    <section aria-labelledby="burza-h">
      <div className="row">
        <h2 id="burza-h" style={{ margin: 0 }}>🏘️ Burza susedov</h2>
        <span className="spacer" />
        <button className="secondary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Zavrieť' : 'Pridať inzerát'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={create} className="card" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <label>
              Druh
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="FOR_SALE">Predám</option>
                <option value="WANTED">Hľadám</option>
                <option value="GIVEAWAY">Zadarmo</option>
                <option value="LOST_AND_FOUND">Straty a nálezy</option>
                <option value="PACKAGE">Mám balík suseda</option>
              </select>
            </label>
            <label>
              Názov
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
          </div>
          <label>
            Popis
            <textarea required rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <label>Cena (€) <input type="number" min={0} value={form.priceEur} onChange={(e) => setForm({ ...form, priceEur: e.target.value })} /></label>
            <label>Telefón <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
            <label>Byt <input value={form.contactApartment} onChange={(e) => setForm({ ...form, contactApartment: e.target.value })} placeholder="byt 07" /></label>
          </div>
          <button type="submit">Zverejniť</button>
        </form>
      )}
      {items.length === 0 ? (
        <div className="empty" style={{ marginTop: '1rem' }}>
          <h3>Burza je zatiaľ prázdna</h3>
          <p>Predáte staré bicykle, hľadáte niekoho na spolu-parkovanie? Zdieľajte so susedmi.</p>
        </div>
      ) : (
        <div className="grid">
          {items.map((c) => (
            <div key={c.id} className="card">
              <div className="card-title-row">
                <h3>{c.title}</h3>
                <span className="tag">{classifiedTypeLabel(c.type)}</span>
              </div>
              {c.priceEur && (
                <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0.25rem 0 0' }}>
                  {Number(c.priceEur).toFixed(2)} €
                </p>
              )}
              <p>{c.body}</p>
              <p className="inline-meta">
                {c.author?.firstName} {c.author?.lastName}
                {c.contactApartment && ` · ${c.contactApartment}`}
                {c.contactPhone && ` · 📞 ${c.contactPhone}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function classifiedTypeLabel(t: string): string {
  const map: Record<string, string> = {
    FOR_SALE: 'Predám',
    WANTED: 'Hľadám',
    GIVEAWAY: 'Zadarmo',
    LOST_AND_FOUND: 'Straty a nálezy',
    PACKAGE: 'Balík suseda',
  };
  return map[t] ?? t;
}

/* ------------------------------------------------------------------- */
/*  Payment history chart                                                */
/* ------------------------------------------------------------------- */

function PaymentHistoryChart({ apartmentId }: { apartmentId: string }) {
  const [data, setData] = useState<Array<{ month: string; paid: number; count: number }>>([]);
  useEffect(() => {
    api<any[]>(`/finance/apartment/${apartmentId}/payment-history`).then(setData).catch(() => {});
  }, [apartmentId]);
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.paid));
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2>📊 História platieb (12 mesiacov)</h2>
      <div className="card">
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 160 }}>
          {data.map((d) => {
            const h = Math.round((d.paid / max) * 100);
            return (
              <div
                key={d.month}
                title={`${d.month}: ${d.paid.toFixed(2)} €`}
                style={{
                  flex: 1,
                  background: d.paid > 0 ? 'linear-gradient(180deg, var(--brand), #14b8a6)' : 'var(--surface-2)',
                  height: `${h}%`,
                  minHeight: 6,
                  borderRadius: '6px 6px 0 0',
                  cursor: 'help',
                }}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {data.map((d) => (
            <div key={d.month} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--fg-subtle)' }}>
              {d.month.slice(5)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QrIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3h-3zM17 17h4M14 21h3M21 14v3M21 20h-2" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ToolIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }}>
      <path d="M12 20h9M4 4h16M4 4v16M4 12h8M4 20h8M16 4l4 4-10 10-4-4z" />
    </svg>
  );
}

function UploadIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M16 8l-4-4-4 4M12 4v12" />
    </svg>
  );
}

function DownloadIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M8 12l4 4 4-4M12 16V4" />
    </svg>
  );
}

function InvoiceIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  );
}

function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function PrintIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
    </svg>
  );
}
