import { Navigate, Link, Route, Routes, useLocation } from "react-router-dom";
import { auth, homeForRole } from "./lib/auth.js";
import { AppShell } from "./components/AppShell.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { PlaceholderPage } from "./pages/PlaceholderPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import InvitationPage from "./pages/InvitationPage.jsx";
import LegalPage from "./pages/LegalPage.jsx";
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
import { StudentCvPage } from "./pages/StudentCvPage.jsx";
import { StudentReportsPage } from "./pages/StudentReportsPage.jsx";
import { StudentImprovementPlanPage } from "./pages/StudentImprovementPlanPage.jsx";
import { StudentPlacementsPage } from "./pages/StudentPlacementsPage.jsx";
import { StudentAiPage } from "./pages/StudentAiPage.jsx";
import {
  PlatformActivityPage,
  PlatformCollegeDetailPage,
  PlatformCollegesPage,
  PlatformDashboardPage,
  PlatformSettingsPage,
  PlatformStaffPage,
  PlatformStudentsPage,
} from "./pages/workspace/PlatformPages.jsx";
import {
  CollegeBatchesPage,
  CollegeDashboardPage,
  CollegeDepartmentsPage,
  CollegeProfilePage,
  CollegeReportsPage,
  CollegeSettingsPage,
  CollegeStaffPage,
  CollegeStudentsPage,
} from "./pages/workspace/CollegePages.jsx";
import {
  TpoDashboardPage,
  TpoPlacementPage,
  TpoReadinessPage,
  TpoReportsPage,
  TpoSettingsPage,
  TpoSkillGapsPage,
  TpoStudentsPage,
} from "./pages/workspace/TpoPages.jsx";
import {
  HodDashboardPage,
  HodDepartmentPage,
  HodReadinessPage,
  HodReportsPage,
  HodSettingsPage,
  HodStudentsPage,
} from "./pages/workspace/HodPages.jsx";
import {
  FacultyDashboardPage,
  FacultyImprovementPlansPage,
  FacultyMenteesPage,
  FacultyReportsPage,
  FacultySettingsPage,
} from "./pages/workspace/FacultyPages.jsx";

const studentRoutes = [
  ["/student/dashboard", StudentDashboardPage],
  ["/student/careers", StudentCareersPage],
  ["/student/assessment", StudentAssessmentPage],
  ["/student/assessment/attempt/:attemptId", AssessmentAttemptPage],
  ["/student/roadmap", StudentRoadmapPage],
  ["/student/cv", StudentCvPage],
  ["/student/reports", StudentReportsPage],
  ["/student/improvement-plan", StudentImprovementPlanPage],
  ["/student/placements", StudentPlacementsPage],
  ["/student/ai", StudentAiPage],
  ["/student/projects", StudentProjectsPage],
  ["/student/linkedin", StudentLinkedInPage],
  ["/student/profile", StudentProfilePage],
  ["/student/progress", StudentProgressPage],
  ["/student/settings", StudentSettingsPage],
];

const roleRoutes = [
  {
    role: "SUPER_ADMIN",
    routes: [
      ["/platform/dashboard", PlatformDashboardPage],
      ["/platform/colleges", PlatformCollegesPage],
      ["/platform/colleges/:id", PlatformCollegeDetailPage],
      ["/platform/staff", PlatformStaffPage],
      ["/platform/students", PlatformStudentsPage],
      ["/platform/activity", PlatformActivityPage],
      ["/platform/settings", PlatformSettingsPage],
    ],
  },
  {
    role: "COLLEGE_ADMIN",
    routes: [
      ["/college/dashboard", CollegeDashboardPage],
      ["/college/profile", CollegeProfilePage],
      ["/college/departments", CollegeDepartmentsPage],
      ["/college/batches", CollegeBatchesPage],
      ["/college/staff", CollegeStaffPage],
      ["/college/students", CollegeStudentsPage],
      ["/college/reports", CollegeReportsPage],
      ["/college/settings", CollegeSettingsPage],
    ],
  },
  {
    role: "TPO",
    routes: [
      ["/tpo/dashboard", TpoDashboardPage],
      ["/tpo/students", TpoStudentsPage],
      ["/tpo/readiness", TpoReadinessPage],
      ["/tpo/skill-gaps", TpoSkillGapsPage],
      ["/tpo/reports", TpoReportsPage],
      ["/tpo/placement", TpoPlacementPage],
      ["/tpo/settings", TpoSettingsPage],
    ],
  },
  {
    role: "HOD",
    routes: [
      ["/hod/dashboard", HodDashboardPage],
      ["/hod/students", HodStudentsPage],
      ["/hod/readiness", HodReadinessPage],
      ["/hod/department", HodDepartmentPage],
      ["/hod/reports", HodReportsPage],
      ["/hod/settings", HodSettingsPage],
    ],
  },
  {
    role: "FACULTY",
    routes: [
      ["/faculty/dashboard", FacultyDashboardPage],
      ["/faculty/mentees", FacultyMenteesPage],
      ["/faculty/improvement-plans", FacultyImprovementPlansPage],
      ["/faculty/reports", FacultyReportsPage],
      ["/faculty/settings", FacultySettingsPage],
    ],
  },
];

function Protected({ roles, children }) {
  const location = useLocation();
  if (!auth.isAuthenticated()) return <Navigate to="/login" replace state={{ from: location }} />;
  const role = auth.getRole();
  if (!roles.includes(role)) return <Navigate to={homeForRole(role)} replace />;
  return <AppShell>{children}</AppShell>;
}

function PublicAuthRedirect() {
  return auth.isAuthenticated() ? <Navigate to={homeForRole(auth.getRole())} replace /> : <LoginPage />;
}

function SiteFrame({ children }) {
  return <div className="site-frame"><header className="site-header"><Link className="brand" to="/">CODEIT <span>CareerOS</span></Link><nav><Link to="/login">Sign in</Link><Link className="nav-cta" to="/register">Get started</Link></nav></header>{children}</div>;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<PublicAuthRedirect />} />
    <Route path="/forgot-password" element={<SiteFrame><ForgotPasswordPage /></SiteFrame>} />
    <Route path="/reset-password" element={<SiteFrame><ResetPasswordPage /></SiteFrame>} />
    <Route path="/register" element={auth.isAuthenticated() ? <Navigate to={homeForRole(auth.getRole())} replace /> : <SiteFrame><RegisterPage /></SiteFrame>} />
    <Route path="/accept-invitation" element={<InvitationPage />} />
    <Route path="/legal/privacy" element={<SiteFrame><LegalPage /></SiteFrame>} />
    <Route path="/legal/terms" element={<SiteFrame><LegalPage /></SiteFrame>} />
    <Route path="/" element={auth.isAuthenticated() ? <Navigate to={homeForRole(auth.getRole())} replace /> : <LandingPage />} />

    {studentRoutes.map(([path, Page]) => (
      <Route key={path} path={path} element={<Protected roles={["STUDENT"]}><Page /></Protected>} />
    ))}
    <Route path="/student/:section" element={<Protected roles={["STUDENT"]}><PlaceholderPage /></Protected>} />

    {roleRoutes.flatMap(({ role, routes }) => routes.map(([path, Page]) => (
      <Route key={path} path={path} element={<Protected roles={[role]}><Page /></Protected>} />
    )))}

    <Route path="*" element={<SiteFrame><PlaceholderPage title="Page not found" /></SiteFrame>} />
  </Routes>;
}
