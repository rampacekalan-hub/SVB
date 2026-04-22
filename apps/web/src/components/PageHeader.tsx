/**
 * PageHeader — jednotný hlavičkový pattern naprieč aplikáciou.
 *   - Breadcrumb (voliteľný)
 *   - Title (H1)
 *   - Subtitle (1 veta kontextu)
 *   - Action slot (primárne tlačidlo vpravo)
 */
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  action,
}: {
  breadcrumb?: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="page-breadcrumb" aria-label="Breadcrumb">
          {breadcrumb.map((b, i) => (
            <span key={i}>
              {b.to ? <Link to={b.to}>{b.label}</Link> : <span>{b.label}</span>}
              {i < breadcrumb.length - 1 && <span className="page-breadcrumb-sep" aria-hidden="true">›</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="page-header-row">
        <div className="page-header-main">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {action && <div className="page-header-action">{action}</div>}
      </div>
    </header>
  );
}
