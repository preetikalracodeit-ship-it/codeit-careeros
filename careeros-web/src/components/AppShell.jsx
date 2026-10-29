import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { auth, homeForRole } from "../lib/auth.js";
import { ROLE_NAV, roleLabel, ROLE_TAGLINES } from "../lib/roles.js";
import { useApi } from "../lib/useApi.js";
import { Icon } from "./Icon.jsx";
import { Avatar } from "./ui.jsx";

export function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const user = auth.getUser();
  const role = user?.role;
  const nav = ROLE_NAV[role] || [];
  const { data: workspace } = useApi("/workspace/me");
  const current = [...nav]
    .sort((left, right) => right.to.length - left.to.length)
    .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
  const college = workspace?.college;
  const department = workspace?.department;

  function signOut() {
    auth.clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className={`app-shell ${open ? "nav-open" : ""}`}>
      <aside className="app-sidebar">
        <div className="app-sidebar-top">
          <Link className="app-brand" to={homeForRole(role)} onClick={() => setOpen(false)}>
            <span className="app-brand-mark">C</span>
            <span>CODEIT <strong>CareerOS</strong></span>
          </Link>
          <button type="button" className="icon-button mobile-only" onClick={() => setOpen(false)} aria-label="Close navigation">
            ×
          </button>
        </div>

        <div className="app-role">
          <span className="app-role-label">{roleLabel(role)}</span>
          <p>{college?.name || ROLE_TAGLINES[role] || ""}</p>
          {department && <span className="app-role-department">{department.name}</span>}
        </div>

        <nav className="app-nav" aria-label="Main navigation">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `app-nav-link ${isActive ? "active" : ""}`}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-user">
            <Avatar name={user?.fullName} size={38} />
            <div>
              <strong>{user?.fullName || "CareerOS member"}</strong>
              <span>{user?.email || ""}</span>
            </div>
          </div>
          <button type="button" className="app-signout" onClick={signOut}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-left">
            <button type="button" className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Open navigation">
              ☰
            </button>
            <div>
              <p className="app-topbar-eyebrow">{roleLabel(role)}</p>
              <strong>{current?.label || "Workspace"}</strong>
            </div>
          </div>
          <div className="app-topbar-right">
            {college?.code && <span className="app-college-chip">{college.code}</span>}
            <span className="app-topbar-date">
              {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </span>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
