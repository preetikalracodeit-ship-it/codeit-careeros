import { LegalLayout } from "@/components/legal/legal-layout";
import { PRIVACY_POLICY } from "@/components/legal/privacy-part-2.js";

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How CODEIT CareerOS collects, uses, and protects your personal information"
    >
      {PRIVACY_POLICY}
    </LegalLayout>
  );
}
