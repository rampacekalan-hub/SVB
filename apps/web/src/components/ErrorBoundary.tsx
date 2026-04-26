/**
 * ErrorBoundary — zachytí React render errors a namiesto bielej obrazovky
 * zobrazí user-friendly správu s možnosťou obnoviť.
 */
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // V produkcii by sme toto poslali do Sentry/GlitchTip.
    // eslint-disable-next-line no-console
    console.error('[Floory ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="err-screen" role="alert">
          <div className="err-card">
            <div className="err-icon">⚠️</div>
            <h1>Ups, niečo sa pokazilo</h1>
            <p>Stránka narazila na chybu. Skúste obnoviť — ak chyba zostane, napíšte nám na hello@floory.sk.</p>
            <details className="err-details">
              <summary>Technický detail</summary>
              <code>{this.state.error?.message}</code>
            </details>
            <div className="err-actions">
              <button className="ui-btn ui-btn-primary" onClick={() => location.reload()}>
                Obnoviť stránku
              </button>
              <a className="ui-btn ui-btn-ghost" href="/">Späť domov</a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function NotFoundPage() {
  return (
    <div className="err-screen">
      <div className="err-card">
        <div className="err-big">404</div>
        <h1>Stránku sme nenašli</h1>
        <p>Možno ste šli za starým odkazom alebo máte preklep v URL.</p>
        <div className="err-actions">
          <a className="ui-btn ui-btn-primary" href="/">Späť na hlavnú</a>
        </div>
      </div>
    </div>
  );
}
