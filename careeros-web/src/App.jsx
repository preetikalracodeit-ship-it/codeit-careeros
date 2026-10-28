import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, LockKeyhole } from "lucide-react";
import { auth, homeForRole } from "./lib/auth.js";
import api from "./lib/api.js";
import GoogleSignInButton from "./components/GoogleSignInButton.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import InvitationPage from "./pages/InvitationPage.jsx";
import CareerCatalogPage from "./pages/CareerCatalogPage.jsx";
import StudentProfilePage from "./pages/StudentProfilePage.jsx";
import AssessmentPage from "./pages/AssessmentPage.jsx";
import AssessmentAttemptPage from "./pages/AssessmentAttemptPage.jsx";
import RoadmapPage from "./pages/RoadmapPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";

const LegalPage = lazy(() => import("./pages/LegalPage.jsx"));
const LegalPageLoading = <main className="landing" role="status">Loading policy…</main>;

const routeGroups = {
  student: [
    ["dashboard", "Dashboard"], ["assessment", "Assessments"], ["assessment/attempt/:attemptId", "Assessment attempt"],
    ["careers", "Careers"], ["cv", "CV analysis"], ["linkedin", "LinkedIn analysis"], ["profile", "Profile"],
    ["progress", "Progress"], ["projects", "Projects"], ["reports", "Reports"], ["roadmap", "Roadmap"],
    ["settings", "Settings"], ["ai", "Career assistant"], ["improvement-plan", "Improvement plan"], ["placements", "Placements"],
    [":section", "Student workspace"],
  ],
  college: [
    ["", "College workspace"], ["dashboard", "Dashboard"], ["students", "Students"], ["students/:id", "Student details"],
    ["import", "Student import"], ["reports", "Reports"], ["staff", "Staff"], ["structure", "College structure"],
    ["settings", "Settings"], ["plans", "Improvement plans"], ["plans/:id", "Improvement plan"], ["placement", "Placement"],
    ["placement/drives/:id", "Placement drive"], ["placement/analytics", "Placement analytics"],
  ],
  admin: [
    ["dashboard", "Dashboard"], ["students", "Students"], ["institutions", "Institutions"], ["assessments", "Assessments"],
    ["assessments/:id", "Assessment editor"], ["careers", "Careers"], ["skills", "Skills"], ["roadmaps", "Roadmaps"],
    ["projects", "Projects"], ["reports", "Reports"], ["settings", "Settings"], ["ai", "AI settings"], [":section", "Admin workspace"],
  ],
};

function Shell() {
  const role = auth.getRole();
  const location = useLocation();
  const navigate = useNavigate();
  const logout = async () => {
    try {
      const refreshToken = auth.getRefreshToken();
      if (refreshToken) await api.post("/auth/logout", { refreshToken });
    } catch {
      // Clear the browser session even when the API cannot be reached.
    } finally {
      auth.clear();
      navigate("/login", { replace: true });
    }
  };
  const home = role === "ADMIN" ? "/admin/dashboard" : role === "PROFESSOR" ? "/college/dashboard" : "/student/dashboard";
  return (
    <div className="app-frame">
      <header className="topbar">
        <Link className="brand" to={home}><span className="brand-mark">C</span><span>CareerOS</span></Link>
        <div className="topbar-actions">
          <span className="role-label">{role === "ADMIN" ? "Administrator" : role === "PROFESSOR" ? "College staff" : "Student"}</span>
          <button className="button button-quiet" onClick={logout}>Sign out</button>
        </div>
      </header>
      <div className="shell-content">
        <aside className="side-nav" aria-label="Main navigation">
          <p className="nav-caption">WORKSPACE</p>
          {routeGroups[role === "ADMIN" ? "admin" : role === "PROFESSOR" ? "college" : "student"].filter(([path]) => path && !path.includes(":")).map(([path, title]) => {
            const href = `${home.split("/").slice(0, 2).join("/")}/${path}`.replace(/\/$/, "");
            return <Link key={path} className={location.pathname === href ? "nav-link active" : "nav-link"} to={href || home}>{title}</Link>;
          })}
        </aside>
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  );
}

function ProtectedRoute({ role }) {
  const location = useLocation();
  const currentRole = auth.getRole();
  if (!auth.getAccessToken() || !["STUDENT", "ADMIN", "PROFESSOR"].includes(currentRole)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (currentRole !== role) return <Navigate to={homeForRole(currentRole)} replace />;
  return <Shell />;
}

function GuestRoute() {
  const token = auth.getAccessToken();
  const role = auth.getRole();
  if (token && ["STUDENT", "ADMIN", "PROFESSOR"].includes(role)) {
    return <Navigate to={homeForRole(role)} replace />;
  }
  return <Outlet />;
}

function Placeholder({ title }) {
  return <section className="page-card"><span className="eyebrow">CAREEROS WORKSPACE</span><h1>{title}</h1><p>This page is included in the React migration route map. Its existing workflow will be ported in the corresponding migration phase.</p><div className="placeholder-note"><LockKeyhole size={18} aria-hidden="true"/><span>Your access is checked by the API for every protected action.</span></div></section>;
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (auth.getAccessToken() && ["STUDENT", "ADMIN", "PROFESSOR"].includes(auth.getRole())) {
      navigate(homeForRole(auth.getRole()), { replace: true });
    }
  }, [navigate]);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await api.post("/auth/login", { email: email.trim(), password }, { skipAuth: true });
      auth.save(result);
      const redirect = new URLSearchParams(location.search).get("redirect");
      const requestedPath = location.state?.from?.pathname || redirect;
      const safePath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : homeForRole(result.user?.role);
      navigate(safePath, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };
  return <main className="auth-layout"><section className="auth-card"><div className="brand auth-brand"><span className="brand-mark">C</span><span>CareerOS</span></div><p className="eyebrow">WELCOME BACK</p><h1>Sign in to your account</h1><p className="muted">Continue to your career workspace.</p><form className="form-stack" onSubmit={submit}><label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={16} /></button></form><GoogleSignInButton mode="signin" onError={setError} /><p className="auth-footnote">New to CareerOS? <Link to="/register">Create a student account</Link></p><p className="auth-footnote">College staff? <Link to="/accept-invitation">Activate an invitation</Link>. Invitation activation is still available in the current CareerOS site during migration.</p></section></main>;
}

function PublicLayout() {
  return <div className="public-frame"><header className="topbar"><Link className="brand" to="/"><span className="brand-mark">C</span><span>CareerOS</span></Link><Link className="button button-quiet" to="/login">Sign in</Link></header><Outlet /></div>;
}

function LandingPage() {
  return <main className="landing"><div className="landing-icon"><BriefcaseBusiness size={27}/></div><p className="eyebrow">YOUR CAREER, IN FOCUS</p><h1>Build your path with CareerOS.</h1><p>One place to understand your strengths, plan your next steps, and prepare for what comes after college.</p><Link className="button button-primary" to="/login">Continue to CareerOS <ArrowRight size={16}/></Link></main>;
}

function NotFound() {
  return <main className="landing"><p className="eyebrow">PAGE NOT FOUND</p><h1>We couldn’t find that page.</h1><p>Check the address or return to the CareerOS home page.</p><Link className="button button-primary" to="/">Go to home</Link></main>;
}

function WorkspaceRoutes({ area }) {
  return routeGroups[area].map(([path, title]) => {
    const page = area === "student" && path === "careers"
      ? <CareerCatalogPage />
      : area === "student" && path === "assessment"
        ? <AssessmentPage />
        : area === "student" && path === "assessment/attempt/:attemptId"
          ? <AssessmentAttemptPage />
      : area === "student" && path === "roadmap"
        ? <RoadmapPage />
        : area === "student" && path === "projects"
          ? <ProjectsPage />
      : area === "student" && path === "profile"
        ? <StudentProfilePage />
        : <Placeholder title={title} />;
    return <Route key={`${area}-${path}`} path={path} element={page} />;
  });
}

export default function App() {
  return <Routes>
    <Route element={<PublicLayout />}>
      <Route index element={<LandingPage />} />
      <Route element={<GuestRoute />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route path="accept-invitation" element={<InvitationPage />} />
      <Route path="legal/terms" element={<Suspense fallback={LegalPageLoading}><LegalPage /></Suspense>} />
      <Route path="legal/privacy" element={<Suspense fallback={LegalPageLoading}><LegalPage /></Suspense>} />
    </Route>
    <Route path="student" element={<ProtectedRoute role="STUDENT" />}>
      <Route index element={<Navigate to="/student/dashboard" replace />} />
      <WorkspaceRoutes area="student" />
    </Route>
    <Route path="college" element={<ProtectedRoute role="PROFESSOR" />}>
      <Route index element={<Navigate to="/college/dashboard" replace />} />
      <WorkspaceRoutes area="college" />
    </Route>
    <Route path="admin" element={<ProtectedRoute role="ADMIN" />}>
      <Route index element={<Navigate to="/admin/dashboard" replace />} />
      <WorkspaceRoutes area="admin" />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>;
}
