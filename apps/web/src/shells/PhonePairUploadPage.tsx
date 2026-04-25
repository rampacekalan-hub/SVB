/**
 * PhonePairUploadPage — verejná stránka /p/:token pre mobilný upload.
 *
 * Predseda na PC vygeneruje QR kód s touto URL, mobil ho naskenuje, otvorí stránku
 * a môže odfotiť faktúru / poruchu. Bez prihlásenia (token v URL je autorizácia).
 *
 * Workflow:
 *   1. Mobil otvorí URL → resolve token → ukáže purpose ('Faktúra' / 'Porucha').
 *   2. Klik na „📷 Odfotiť" → otvorí kameru (input type=file capture=camera).
 *   3. Po výbere → upload → ukáže ✓ + možnosť odfotiť ďalšiu.
 *   4. PC strana polluje a po doručení sa formulár pre-vyplní.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

interface SessionInfo {
  id: string;
  purpose: 'INCOMING_INVOICE_PHOTO' | 'TICKET_PHOTO' | 'DOCUMENT_PHOTO';
  expiresAt: string;
}

const PURPOSE_LABEL: Record<SessionInfo['purpose'], { title: string; icon: string; sub: string }> = {
  INCOMING_INVOICE_PHOTO: {
    title: 'Odfotiť faktúru',
    icon: '🧾',
    sub: 'Odfoťte faktúru tak, aby boli viditeľné suma, dátum a IČO.',
  },
  TICKET_PHOTO: {
    title: 'Odfotiť poruchu',
    icon: '🔧',
    sub: 'Odfoťte poškodenie / problém z viacerých uhlov.',
  },
  DOCUMENT_PHOTO: {
    title: 'Odfotiť dokument',
    icon: '📄',
    sub: 'Odfoťte dokument na rovnom povrchu, dobre osvetlený.',
  },
};

export function PhonePairUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/phone-pairing/token/${token}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setInfo)
      .catch((e) => setErr(typeof e === 'string' ? e : 'Token neplatný alebo expiroval.'));
  }, [token]);

  async function uploadFile(file: File) {
    if (!token) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/phone-pairing/token/${token}/upload`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      setUploaded((n) => n + 1);
    } catch (e) {
      setErr('Upload zlyhal: ' + (e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (err && !info) {
    return (
      <div className="phone-pair">
        <div className="phone-pair-card">
          <div className="phone-pair-icon">⚠️</div>
          <h1>Token neplatný</h1>
          <p>Tento odkaz je expirovaný alebo bol už použitý. Vráťte sa na PC a vygenerujte nový.</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="phone-pair">
        <p style={{ textAlign: 'center', marginTop: 40 }}>Načítavam…</p>
      </div>
    );
  }

  const meta = PURPOSE_LABEL[info.purpose];

  return (
    <div className="phone-pair">
      <div className="phone-pair-card">
        <div className="phone-pair-icon">{meta.icon}</div>
        <h1>{meta.title}</h1>
        <p className="phone-pair-sub">{meta.sub}</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />

        <button
          className="phone-pair-cta"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? 'Nahrávam…' : uploaded > 0 ? '📷 Odfotiť ďalšiu' : '📷 Odfotiť'}
        </button>

        {uploaded > 0 && (
          <div className="phone-pair-success">
            ✓ Odoslaných: <strong>{uploaded}</strong> {uploaded === 1 ? 'foto' : uploaded < 5 ? 'fotky' : 'fotiek'}
            <p>Foto sa zobrazila na PC. Môžete odfotiť ďalšiu, alebo ukončiť.</p>
          </div>
        )}

        {err && <div className="phone-pair-err">{err}</div>}

        <p className="phone-pair-foot">
          Platí do {new Date(info.expiresAt).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
