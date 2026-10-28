"use client";

// Nav definitions live in a client module so the lucide icon components are
// client references — legal to pass from server layouts into the client shell.
import {
  LayoutDashboard,
  UserRound,
  Target,
  ClipboardList,
  Route,
  FolderKanban,
  FileText,
  Share2,
  Sparkles,
  TrendingUp,
  FileBarChart,
  Settings,
  Users,
  Briefcase,
  Lightbulb,
  HelpCircle,
  Bot,
  Building2,
  UserCog,
} from "lucide-react";

const studentNav = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard, section: "Overview" },
  { label: "Profile", href: "/student/profile", icon: UserRound, section: "Overview" },

  { label: "Career Selection", href: "/student/careers", icon: Target, section: "Growth" },
  { label: "Assessment", href: "/student/assessment", icon: ClipboardList, section: "Growth" },
  { label: "Roadmap", href: "/student/roadmap", icon: Route, section: "Growth" },
  { label: "Improvement Plan", href: "/student/improvement-plan", icon: ClipboardList, section: "Growth" },
  { label: "Placements", href: "/student/placements", icon: Briefcase, section: "Growth" },
  { label: "Projects", href: "/student/projects", icon: FolderKanban, section: "Growth" },

  { label: "CV Analysis", href: "/student/cv", icon: FileText, section: "Analysis" },
  { label: "LinkedIn Analysis", href: "/student/linkedin", icon: Share2, section: "Analysis" },
  { label: "AI Assistant", href: "/student/ai", icon: Sparkles, section: "Analysis" },

  { label: "Progress", href: "/student/progress", icon: TrendingUp, section: "System" },
  { label: "Reports", href: "/student/reports", icon: FileBarChart, section: "System" },
  { label: "Settings", href: "/student/settings", icon: Settings, section: "System" },
];

const adminNav = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, section: "Overview" },
  { label: "Students", href: "/admin/students", icon: Users, section: "Overview" },
  { label: "Institutions", href: "/admin/institutions", icon: Building2, section: "Overview" },

  { label: "Careers", href: "/admin/careers", icon: Briefcase, section: "Content" },
  { label: "Skills", href: "/admin/skills", icon: Lightbulb, section: "Content" },
  { label: "Assessments", href: "/admin/assessments", icon: ClipboardList, section: "Content" },
  { label: "Roadmaps", href: "/admin/roadmaps", icon: Route, section: "Content" },
  { label: "Projects", href: "/admin/projects", icon: FolderKanban, section: "Content" },

  { label: "Reports", href: "/admin/reports", icon: FileBarChart, section: "Analysis" },

  { label: "AI Configuration", href: "/admin/ai", icon: Bot, section: "System" },
  { label: "Settings", href: "/admin/settings", icon: Settings, section: "System" },
];

// Items marked with a permission are only rendered after /college/me
// confirms the server-side authority. The backend enforces the same checks.
const collegeNav = [
  { label: "Overview", href: "/college/dashboard", icon: LayoutDashboard, section: "Overview" },
  { label: "Students", href: "/college/students", icon: Users, section: "Overview", permission: "VIEW_STUDENTS" },
  { label: "Improvement Plans", href: "/college/plans", icon: ClipboardList, section: "Students", permission: "VIEW_IMPROVEMENT_PLANS" },
  { label: "Placement", href: "/college/placement", icon: Briefcase, section: "Placement", permission: "VIEW_PLACEMENT" },
  { label: "Placement Analytics", href: "/college/placement/analytics", icon: TrendingUp, section: "Placement", permission: "VIEW_PLACEMENT_REPORTS" },
  { label: "Staff & Access", href: "/college/staff", icon: UserCog, section: "Institution", permission: "MANAGE_STAFF" },
  { label: "Academic Structure", href: "/college/structure", icon: Building2, section: "Institution", permission: "MANAGE_STRUCTURE" },
  { label: "Reports", href: "/college/reports", icon: FileBarChart, section: "Analysis", permission: "GENERATE_REPORTS" },
  { label: "Settings", href: "/college/settings", icon: Settings, section: "System" },
];

export { studentNav, adminNav, collegeNav };
