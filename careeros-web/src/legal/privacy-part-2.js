// CODEIT CareerOS — Privacy Policy content (react-markdown)
// Last updated: October 26, 2026

import { PRIVACY_PART_1 } from "./privacy-part-1.js";

export const LAST_UPDATED = "October 26, 2026";

// Owner-provided public contact details, supplied at build time. Never invent
// a legal address; when unset, the page says so plainly instead of showing a
// fake placeholder address.
const LEGAL_EMAIL = (import.meta.env.VITE_LEGAL_CONTACT_EMAIL || "").trim();
const LEGAL_WEBSITE = (import.meta.env.VITE_LEGAL_WEBSITE || "").trim();
const CONTACT_DETAILS = LEGAL_EMAIL
  ? [
      `- **Email:** ${LEGAL_EMAIL}`,
      LEGAL_WEBSITE ? `- **Website:** ${LEGAL_WEBSITE}` : null,
    ].filter(Boolean).join("\n")
  : "- **Contact:** This deployment has not been configured with a monitored privacy contact. Please use your institution's designated support channel.";

export const PRIVACY_PART_2 = `## 6. Your Privacy Rights

Depending on your jurisdiction, you may have the right to:

- Request access to the Personal Data we hold about you;
- Request correction of inaccurate or incomplete data;
- Request deletion of your Personal Data (subject to legal retention requirements);
- Request restriction or suppression of your data;
- Object to processing of your data;
- Request data portability;
- Withdraw consent at any time where processing is based on consent.

To exercise any of these rights, please contact us using the details below. We will respond within 30 days.

## 7. Children's Privacy

The Service is not directed to children under the age of 13, and we do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us, and we will take steps to delete such data.

## 8. Third-Party Links

The Service may contain links to third-party websites, services, and applications. We are not responsible for the privacy practices or content of those third parties. We encourage you to review the privacy policies of any third parties you visit.

## 9. Changes to This Policy

We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or applicable law. We will notify users of material changes via email or a notice posted on the Service. Your continued use of the Service after the effective date of the changes constitutes acceptance of the updated policy.

## 10. Contact Us

If you have any questions about this Privacy Policy or your data, please contact us:

- **Services:** CODEIT CareerOS
${CONTACT_DETAILS}

`;

export const PRIVACY_POLICY = PRIVACY_PART_1 + PRIVACY_PART_2;
