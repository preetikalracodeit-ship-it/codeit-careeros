import { CollegeShell } from "@/components/shell/college-shell";

export const metadata = { title: "College Console" };

export default function CollegeLayout({ children }) {
  return <CollegeShell>{children}</CollegeShell>;
}
