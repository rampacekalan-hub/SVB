/**
 * ActivatePage — aktivácia aktivačným kódom.
 *
 * Flow:
 *   1. Zadá kód (alebo je pre-filled z URL /aktivacia/:code, /r/:code)
 *   2. Overíme cez GET /auth/activation-code/:code/preview — non-consuming.
 *      Ukážeme rolu + budovu + byt.
 *   3a. NEMÁ účet → vyplní meno/email/heslo → POST /auth/register.
 *   3b. UŽ má účet (email konflikt pri registrácii) → ponúkneme
 *       prihlásenie + automatické naviazanie kódu cez POST /auth/activation-code/:code/link.
 *
 * Navigácia po úspechu:
 *   OWNER → /moj-dom/domov
 *   CHAIRMAN/MANAGER/ADMIN → /b/<buildingId>
 *   MAINTENANCE → /b/<buildingId> (zatiaľ)
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, setTokens, getAccessToken } from '../api';
import { PageHeader } from '../components/PageHeader';
import { Btn } from '../components/Button';
import { Field, Form, Row } from '../components/forms';
import { StatusPill } from '../components/ui';
import { AuthRoleStrip } from '../components/AuthRoleStrip';
import type { Me } from '../types';

interface PreviewResult {
  role: 'OWNER' | 'CHAIRMAN' | 'MANAGER' | 'MAINTENANCE' | 'ADMIN';
  building: { id: string; name: string; city: string };
  apartment: { id: string; unitNumber: string } | null;
}

const ROLE_LABEL: Record<PreviewResult['role'], string> = {
  OWNER: 'Vlastník bytu',
  CHAIRMAN: 'Predseda',
  MANAGER: 'Správca',
  MAINTENANCE: 'Údržbár',
  OWNER_: 'Vlastník',
  ADMIN: 'Administrátor',
} as any;

function targetUrlFor(preview: PreviewResult): string {
  if (preview.role === 'OWNER') return '/moj-dom/domov';
  return `/b/${preview.building.id}`;
}

export function ActivatePage({ onLoggedIn }: { onLoggedIn: (me: Me) => void }) {
  const { code: urlCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  const [code, setCode] = useState(urlCode ?? '');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [fieldErrs, setFieldErrs] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (urlCode) verifyCode(urlCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode]);

  async function verifyCode(c: string) {
    if (!c) return;
    setChecking(true);
    setCodeErr(null);
    setPreview(null);
    try {
      const r = await api<PreviewResult>(`/auth/activation-code/${encodeURIComponent(c.trim())}/preview`);
      setPreview(r);
      // Ak je user už prihlásený, ponúkneme okamžité pripojenie bez registrácie
      if (getAccessToken()) {
        await linkToExistingAccount(r);
      }
    } catch (e) {
      setCodeErr((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function linkToExistingAccount(p: PreviewResult) {
    try {
      await api(`/auth/activation-code/${encodeURIComponent(code.trim())}/link`, { method: 'POST' });
      const me = await api<Me>('/users/me');
      onLoggedIn(me);
      navigate(targetUrlFor(p), { replace: true });
    } catch (e) {
      setFormErr((e as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!preview) return;
    setFieldErrs({});
    setFormErr(null);
    setEmailExists(false);

    // Klientová validácia
    const errs: typeof fieldErrs = {};
    if (!form.firstName.trim()) errs.firstName = 'Zadajte meno.';
    if (!form.lastName.trim()) errs.lastName = 'Zadajte priezvisko.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Neplatný email.';
    if (form.password.length < 10) errs.password = 'Heslo musí mať aspoň 10 znakov.';
    if (Object.keys(errs).length > 0) { setFieldErrs(errs); return; }

    setBusy(true);
    try {
      const res = await api<{ accessToken: string; refreshToken: string }>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            firstName: form.firstName,
            lastName: form.lastName,
            activationCode: code.trim(),
          }),
        },
      );
      setTokens(res.accessToken, res.refreshToken);
      const me = await api<Me>('/users/me');
      onLoggedIn(me);
      navigate(targetUrlFor(preview), { replace: true });
    } catch (e) {
      if (e instanceof ApiError) {
        // Email konflikt — ponúkneme špeciálny flow
        if (e.status === 409 && /email/i.test(e.message)) {
          setEmailExists(true);
          setFormErr(null);
          return;
        }
        // Pokús sa priradiť message k poľu
        if (/heslo/i.test(e.message) || /password/i.test(e.message)) {
          setFieldErrs({ password: e.message }); return;
        }
        if (/email/i.test(e.message)) {
          setFieldErrs({ email: e.message }); return;
        }
        setFormErr(e.message);
      } else {
        setFormErr((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card" role="main" style={{ maxWidth: 520 }}>
        <AuthRoleStrip />
        <PageHeader
          title={preview ? `Vitajte v ${preview.building.name}` : 'Aktivácia účtu'}
          subtitle={
            preview
              ? 'Vytvorte si účet a pripojte sa k budove.'
              : 'Dostali ste aktivačný kód od predsedu alebo správcu budovy? Zadajte ho nižšie.'
          }
        />

        {!preview && (
          <>
            <Field
              label="Aktivačný kód"
              required
              hint="Nájdete ho v papierovej pozvánke, SMS alebo emaili. Zvyčajne 12 znakov."
              error={codeErr}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                placeholder="A1B2C3D4E5F6"
                style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em', fontSize: 16 }}
                autoFocus
              />
            </Field>
            <div className="form-actions" style={{ marginTop: 12 }}>
              <Btn busy={checking} disabled={code.trim().length < 4} onClick={() => verifyCode(code)} block>
                {checking ? 'Overujem…' : 'Overiť kód →'}
              </Btn>
            </div>
            <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <p className="inline-meta" style={{ textAlign: 'center' }}>
              Máte už účet? <Link to="/prihlasenie">Prihlásiť sa</Link>
            </p>
          </>
        )}

        {preview && (
          <>
            <div className="preview-box">
              <StatusPill tone="ok" dot>Kód je platný</StatusPill>
              <div style={{ marginTop: 12, fontSize: '1.125rem', fontWeight: 600 }}>
                {preview.building.name}
              </div>
              <div className="inline-meta">
                {preview.building.city}
                {preview.apartment && <> · byt <strong>{preview.apartment.unitNumber}</strong></>}
                <br />
                Rola: <strong>{ROLE_LABEL[preview.role]}</strong>
              </div>
              <button
                type="button"
                onClick={() => { setPreview(null); setCode(''); setFormErr(null); setEmailExists(false); setFieldErrs({}); }}
                style={{ marginTop: 8, background: 'transparent', border: 'none', color: 'var(--brand)', cursor: 'pointer', padding: 0, fontSize: 13 }}
              >
                ← zmeniť kód
              </button>
            </div>

            {emailExists ? (
              <div style={{ padding: '1rem 1.25rem', background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 10 }}>
                <strong style={{ color: 'var(--info-600)' }}>Účet s týmto emailom už existuje</strong>
                <p style={{ margin: '8px 0 12px', color: 'var(--fg-muted)' }}>
                  Ak je to váš účet, prihláste sa — <strong>byt {preview.apartment?.unitNumber ?? ''}</strong> pripojíme
                  automaticky po prihlásení. Nemusíte vytvárať druhý účet.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link
                    to={`/prihlasenie?next=${encodeURIComponent(`/aktivacia/${code}`)}`}
                    className="ui-btn ui-btn-primary"
                  >
                    Prihlásiť sa
                  </Link>
                  <Btn variant="ghost" onClick={() => { setEmailExists(false); setForm({ ...form, email: '' }); }}>
                    Zmeniť email
                  </Btn>
                </div>
              </div>
            ) : (
              <Form
                title=""
                onSubmit={submit}
                error={formErr}
                actions={
                  <Btn busy={busy} block type="submit">
                    {busy ? 'Vytváram účet…' : 'Vytvoriť účet a prihlásiť sa'}
                  </Btn>
                }
              >
                <Row>
                  <Field label="Meno" required error={fieldErrs.firstName}>
                    <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoFocus />
                  </Field>
                  <Field label="Priezvisko" required error={fieldErrs.lastName}>
                    <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </Field>
                </Row>
                <Field label="Email" required hint="Na tento email vám budeme posielať dôležité oznamy a faktúry." error={fieldErrs.email}>
                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
                <Field
                  label="Heslo"
                  required
                  hint="Minimálne 10 znakov."
                  error={fieldErrs.password ?? (form.password.length > 0 && form.password.length < 10 ? 'Heslo musí mať aspoň 10 znakov.' : null)}
                >
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </Field>
              </Form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
