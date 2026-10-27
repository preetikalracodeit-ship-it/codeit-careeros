// CODEIT CareerOS — Terms of Service content (react-markdown)
// Last updated: October 26, 2026

import { TERMS_PART_1 } from "./terms-part-1.js";

const LAST_UPDATED = "October 26, 2026";

// Owner-provided public contact details, supplied at build time. Never invent
// a legal address; when unset, the page says so plainly instead of showing a
// fake placeholder address.
const LEGAL_EMAIL = (process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || "").trim();
const LEGAL_WEBSITE = (process.env.NEXT_PUBLIC_LEGAL_WEBSITE || "").trim();
const CONTACT_DETAILS = LEGAL_EMAIL
  ? [
      `- **Email:** ${LEGAL_EMAIL}`,
      LEGAL_WEBSITE ? `- **Website:** ${LEGAL_WEBSITE}` : null,
    ].filter(Boolean).join("\n")
  : "- **Contact:** This deployment has not been configured with a monitored legal contact. Please use your institution's designated support channel.";

export const TERMS_PART_2 = `## 9. Termination

We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, for any reason, including breach of these Terms. Upon termination, your right to use the Service will cease. Subject to applicable law, all provisions of these Terms that are intended to survive termination shall survive termination.

## 10. Governing Law and Dispute Resolution

These Terms shall be governed by and construed in accordance with the laws of the applicable jurisdiction, without regard to its conflict-of-law principles. Any dispute arising out of or related to these Terms shall be resolved through binding arbitration or, where prohibited, in the courts of the applicable jurisdiction.

## 11. Changes to These Terms

We reserve the right to modify these Terms at any time. We will notify users of material changes via email or a notice posted on the Service. Your continued use of the Service after the effective date of the changes constitutes acceptance of the updated Terms.

## 12. Contact Us

If you have any questions about these Terms, please contact us:

- **Services:** CODEIT CareerOS
${CONTACT_DETAILS}

`;

export const TERMS_OF_SERVICE = TERMS_PART_1 + TERMS_PART_2;
