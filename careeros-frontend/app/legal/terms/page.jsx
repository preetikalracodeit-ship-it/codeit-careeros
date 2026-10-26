import { LegalLayout } from "@/components/legal/legal-layout";
import { TERMS_OF_SERVICE } from "@/components/legal/terms-part-2.js";

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The terms and conditions governing your use of the CareerOS platform"
    >
      {TERMS_OF_SERVICE}
    </LegalLayout>
  );
}
