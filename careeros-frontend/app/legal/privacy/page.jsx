import { LegalLayout } from "@/components/legal/legal-layout";
import { PRIVACY_LAST_UPDATED } from "@/components/legal/privacy-part-1.js";
import { PRIVACY_POLICY } from "@/components/legal/privacy-part-2.js";

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How CODEIT CareerOS collects, uses, and protects your personal information"
      lastUpdated={PRIVACY_LAST_UPDATED}
    >
      {PRIVACY_POLICY}
    </LegalLayout>
  );
}
