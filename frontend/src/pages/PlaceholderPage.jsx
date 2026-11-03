export function PlaceholderPage({ title = "CareerOS", children }) {
  return <main className="placeholder-page"><span className="eyebrow">CAREEROS</span><h1>{title}</h1><p className="muted">This route is ready for its migrated page.</p>{children}</main>;
}
