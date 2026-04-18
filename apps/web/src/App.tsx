import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, clearTokens, getAccessToken, setTokens } from './api';

interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: 'SK' | 'CS';
  seniorMode: boolean;
  memberships: Array<{
    role: string;
    building: { id: string; name: string; city: string };
    apartment?: { id: string; unitNumber: string } | null;
  }>;
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    api<Me>('/users/me')
      .then((u) => {
        setMe(u);
        document.documentElement.dataset.senior = String(u.seniorMode);
      })
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: '2rem' }}>Načítavam…</p>;

  return (
    <>
      <header className="topbar">
        <strong>DomovPlus</strong>
        {me && (
          <span>
            {me.firstName} {me.lastName} ·{' '}
            <button
              className="secondary"
              onClick={() => {
                clearTokens();
                location.href = '/';
              }}
            >
              Odhlásiť
            </button>
          </span>
        )}
      </header>
      <main>
        <Routes>
          <Route path="/" element={me ? <Dashboard me={me} /> : <Login onLogin={setMe} />} />
          <Route path="/building/:buildingId" element={me ? <Building /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </>
  );
}

function Login({ onLogin }: { onLogin: (me: Me) => void }) {
  const [email, setEmail] = useState('predseda@domovplus.local');
  const [password, setPassword] = useState('DemoHeslo12345!');
  const [totpToken, setTotpToken] = useState('');
  const [mfaNeeded, setMfaNeeded] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
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
        document.documentElement.dataset.senior = String(me.seniorMode);
        onLogin(me);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '2rem auto' }}>
      <h2>Prihlásenie</h2>
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Heslo
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {mfaNeeded && (
          <label>
            TOTP kód (6 číslic)
            <input
              pattern="\d{6}"
              value={totpToken}
              onChange={(e) => setTotpToken(e.target.value)}
              required
            />
          </label>
        )}
        <button type="submit">Prihlásiť</button>
        {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      </form>
    </div>
  );
}

function Dashboard({ me }: { me: Me }) {
  const navigate = useNavigate();
  return (
    <>
      <h1>Vitajte, {me.firstName}</h1>
      <h2>Vaše budovy</h2>
      {me.memberships.length === 0 && <p>Zatiaľ nie ste priradený k žiadnej budove.</p>}
      {me.memberships.map((m) => (
        <div
          key={m.building.id + m.role}
          className="card"
          onClick={() => navigate(`/building/${m.building.id}`)}
          style={{ cursor: 'pointer' }}
        >
          <h3>{m.building.name}</h3>
          <p>
            {m.building.city} · <span className="tag">{m.role}</span>
            {m.apartment && <> · byt {m.apartment.unitNumber}</>}
          </p>
        </div>
      ))}
    </>
  );
}

function Building() {
  const buildingId = window.location.pathname.split('/')[2];
  const [votings, setVotings] = useState<Array<any>>([]);
  const [announcements, setAnnouncements] = useState<Array<any>>([]);
  const [tickets, setTickets] = useState<Array<any>>([]);

  useEffect(() => {
    api<any[]>(`/voting/building/${buildingId}`).then(setVotings).catch(() => {});
    api<any[]>(`/announcements/feed`).then(setAnnouncements).catch(() => {});
    api<any[]>(`/tickets/building/${buildingId}`).then(setTickets).catch(() => {});
  }, [buildingId]);

  return (
    <>
      <h1>Budova</h1>

      <section>
        <h2>Hlasovania</h2>
        {votings.length === 0 && <p>Žiadne hlasovania.</p>}
        {votings.map((v) => (
          <div key={v.id} className="card">
            <h3>{v.title}</h3>
            <p>{v.description}</p>
            <p>
              <span className="tag">{v.status}</span> · typ: {v.type} · uzávierka:{' '}
              {new Date(v.closesAt).toLocaleString('sk-SK')}
            </p>
            {v.result && (
              <p>
                <span className={'tag ' + (v.result.accepted ? 'ok' : 'err')}>
                  {v.result.accepted ? 'PRIJATÉ' : 'ZAMIETNUTÉ'}
                </span>{' '}
                · kvórum {v.result.quorumReached ? 'dosiahnuté' : 'nedosiahnuté'}
              </p>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2>Nástenka</h2>
        {announcements.length === 0 && <p>Žiadne oznamy.</p>}
        {announcements.map((r: any) => (
          <div key={r.id} className="card">
            <h3>{r.announcement.title}</h3>
            <p>{r.announcement.body}</p>
            {!r.readAt && (
              <button
                onClick={async () => {
                  await api(`/announcements/receipts/${r.id}/read`, { method: 'PATCH' });
                  setAnnouncements((prev) =>
                    prev.map((x) => (x.id === r.id ? { ...x, readAt: new Date().toISOString() } : x)),
                  );
                }}
              >
                Potvrdiť prečítanie
              </button>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2>Poruchy</h2>
        {tickets.length === 0 && <p>Žiadne nahlásené poruchy.</p>}
        {tickets.map((t) => (
          <div key={t.id} className="card">
            <h3>{t.title}</h3>
            <p>
              <span className="tag">{t.status}</span> · priorita: {t.priority}
              {t.apartment && <> · byt {t.apartment.unitNumber}</>}
            </p>
            <p>{t.description}</p>
          </div>
        ))}
      </section>
    </>
  );
}
