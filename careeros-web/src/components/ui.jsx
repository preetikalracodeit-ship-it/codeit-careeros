import { Icon } from "./Icon.jsx";

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, hint, tone = "default", icon }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-card-top">
        <span>{label}</span>
        {icon && <span className="stat-icon"><Icon name={icon} size={17} /></span>}
      </div>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

export function Panel({ title, description, actions, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-heading">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const TONES = {
  default: "",
  positive: "badge-positive",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
  muted: "badge-muted",
};

export function Badge({ children, tone = "default" }) {
  return <span className={`badge ${TONES[tone] || tone}`}>{children}</span>;
}

export function statusTone(status) {
  if (status === "ACTIVE") return "positive";
  if (status === "ONBOARDING") return "warning";
  if (status === "SUSPENDED" || status === "LOCKED") return "danger";
  if (status === "INACTIVE") return "muted";
  return "default";
}

export function DataTable({ columns, rows, empty, getKey }) {
  if (!rows?.length) {
    return <EmptyState title={empty || "Nothing here yet"} description="Data will appear here as the workspace grows." />;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getKey ? getKey(row) : row.id ?? index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, description, action, icon = "spark" }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={20} /></span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function LoadingBlock({ label = "Loading workspace…" }) {
  return (
    <div className="state-block" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div className="state-block state-error" role="alert">
      <strong>We could not load this section.</strong>
      <p>{message}</p>
      {onRetry && <button type="button" className="secondary-button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function ProgressBar({ value, tone = "" }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`meter ${tone}`} aria-hidden="true">
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

export function Distribution({ distribution }) {
  const rows = [
    { key: "STRONG", label: "Strong", tone: "tone-strong" },
    { key: "GOOD", label: "Good", tone: "tone-good" },
    { key: "DEVELOPING", label: "Developing", tone: "tone-developing" },
    { key: "NEEDS_IMPROVEMENT", label: "Needs improvement", tone: "tone-needs" },
    { key: "PRIORITY_GAP", label: "Priority gap", tone: "tone-priority" },
  ];
  const total = rows.reduce((sum, row) => sum + (distribution?.[row.key] || 0), 0) || 1;
  return (
    <div className="distribution">
      {rows.map((row) => {
        const count = distribution?.[row.key] || 0;
        return (
          <div className="distribution-row" key={row.key}>
            <div className="distribution-label">
              <span>{row.label}</span>
              <strong>{count}</strong>
            </div>
            <div className="distribution-track">
              <span className={row.tone} style={{ width: `${(count / total) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Avatar({ name, size = 40 }) {
  const label = (name || "CareerOS")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size / 2.8 }} aria-hidden="true">
      {label}
    </span>
  );
}
