import { Navigate, Link, Route, Routes, useLocation } from "react-router-dom";
import { auth, homeForRole } from "./lib/auth.js";
import { LoginPage } from "./pages/LoginPage.jsx";
import { PlaceholderPage } from "./pages/PlaceholderPage.jsx";
import { StudentCareersPage } from "./pages/StudentCareersPage.jsx";
import { StudentAssessmentPage } from "./pages/StudentAssessmentPage.jsx";
import { AssessmentAttemptPage } from "./pages/AssessmentAttemptPage.jsx";
import { StudentProfilePage } from "./pages/StudentProfilePage.jsx";
import { StudentDashboardPage } from "./pages/StudentDashboardPage.jsx";
import { ForgotPasswordPage, ResetPasswordPage } from "./pages/PasswordRecoveryPage.jsx";
import { StudentProgressPage } from "./pages/StudentProgressPage.jsx";
import { StudentSettingsPage } from "./pages/StudentSettingsPage.jsx";
import { StudentRoadmapPage } from "./pages/StudentRoadmapPage.jsx";
import { StudentProjectsPage } from "./pages/StudentProjectsPage.jsx";
import { StudentLinkedInPage } from "./pages/StudentLinkedInPage.jsx";

const publicRoutes = ["/", "/accept-invitation", "/legal/privacy", "/legal/terms"];
const studentRoutes = [
  "/student/dashboard", "/student/careers", "/student/assessment", "/student/assessment/attempt/:attemptId",
  "/student/roadmap", "/student/projects", "/student/cv", "/student/linkedin", "/student/profile",
  "/student/progress", "/student/reports", "/student/settings", "/student/ai",
  "/student/improvement-plan", "/student/placements", "/student/:section",
];
const collegeRoutes = [
  "/college", "/college/dashboard", "/college/students", "/college/students/:id", "/college/import",
  "/college/reports", "/college/staff", "/college/structure", "/college/settings", "/college/plans",
  "/college/plans/:id", "/college/placement", "/college/placement/analytics", "/college/placement/drives/:id",
];
const adminRoutes = [
  "/admin/dashboard", "/admin/students", "/admin/institutions", "/admin/assessments", "/admin/assessments/:id",
  "/admin/careers", "/admin/skills", "/admin/roadmaps", "/admin/projects", "/admin/reports", "/admin/settings", "/admin/ai", "/admin/:section",
];

function Guard({ role, children }) {
  const location = useLocation();
  if (!auth.isAuthenticated()) return <Navigate to="/login" replace state={{ from: location }} />;
  if (auth.getRole() !== role) return <Navigate to={homeForRole(auth.getRole())} replace />;
  return children;
}

function PublicAuthRedirect() {
  return auth.isAuthenticated() ? <Navigate to={homeForRole(auth.getRole())} replace /> : <LoginPage />;
}

function SiteFrame({ children }) {
  return <div className="site-frame"><header className="site-header"><Link className="brand" to="/">CODEIT <span>CareerOS</span></Link><nav><Link to="/login">Sign in</Link><Link className="nav-cta" to="/register">Get started</Link></nav></header>{children}</div>;
}

function protectedElement(role) {
  return <Guard role={role}><SiteFrame><PlaceholderPage /></SiteFrame></Guard>;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<PublicAuthRedirect />} />
    <Route path="/forgot-password" element={<SiteFrame><ForgotPasswordPage /></SiteFrame>} />
    <Route path="/reset-password" element={<SiteFrame><ResetPasswordPage /></SiteFrame>} />
    <Route path="/register" element={auth.isAuthenticated() ? <Navigate to={homeForRole(auth.getRole())} replace /> : <SiteFrame><PlaceholderPage title="Create your CareerOS account" /></SiteFrame>} />
    {publicRoutes.filter((path) => path !== "/").map((path) => <Route key={path} path={path} element={<SiteFrame><PlaceholderPage /></SiteFrame>} />)}
    <Route path="/" element={<SiteFrame><PlaceholderPage title="Know where you stand. Know what to do next." /></SiteFrame>} />
    {studentRoutes.map((path) => {
      const page = path === "/student/careers" ? <StudentCareersPage />
        : path === "/student/assessment" ? <StudentAssessmentPage />
          : path === "/student/assessment/attempt/:attemptId" ? <AssessmentAttemptPage />
            : path === "/student/profile" ? <StudentProfilePage />
              : path === "/student/dashboard" ? <StudentDashboardPage />
                : path === "/student/progress" ? <StudentProgressPage />
                  : path === "/student/settings" ? <StudentSettingsPage />
                    : path === "/student/roadmap" ? <StudentRoadmapPage />
                      : path === "/student/projects" ? <StudentProjectsPage />
                        : path === "/student/linkedin" ? <StudentLinkedInPage /> : <PlaceholderPage />;
      return <Route key={path} path={path} element={<Guard role="STUDENT"><SiteFrame>{page}</SiteFrame></Guard>} />;
    })}
    {collegeRoutes.map((path) => <Route key={path} path={path} element={protectedElement("PROFESSOR")} />)}
    {adminRoutes.map((path) => <Route key={path} path={path} element={protectedElement("ADMIN")} />)}
    <Route path="*" element={<SiteFrame><PlaceholderPage title="Page not found" /></SiteFrame>} />
  </Routes>;
}
