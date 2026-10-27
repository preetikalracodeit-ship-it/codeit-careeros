# CareerOS — Data Retention and Deletion Lifecycle

> Status: **policy-blocked**. No account-deletion, data-export, or retention job
> is implemented. This document is the data inventory and the decision record
> needed before any of that code is written. It deliberately invents no
> retention periods and no legal basis.

## 1. What personal data exists

### 1.1 Account and security

| Table | Data | Notes |
|---|---|---|
| `users` | email, full name, BCrypt password hash, role, status, created/updated timestamps | One row per account; email unique |
| `refresh_tokens` | user id, SHA-256 token hash, expiry, revoked flag, replacement id, created | Never stores the raw token |
| `consent_records` | user id, consent type, policy version, method, evidence label, accepted-at | Append-only; no IP/user-agent |
| `audit_events` | actor id/role, HTTP method + route, path, outcome, status, request id, timestamp | Platform-admin actions and denied admin attempts; no bodies, tokens, or PII values |
| Application logs | request id, method, path, status, user id in some service logs | Retained by the hosting/log platform, not the database |

### 1.2 Student profile and academic data

| Table | Data |
|---|---|
| `student_profiles` | student id, full name, mobile, date of birth, free-text college/degree/branch, graduation year, semester, location, GitHub/LinkedIn/portfolio URLs, profile-photo URL, target career |
| `student_profiles.profile_photo_url` | Reference to a private photo object; the binary is outside MySQL |

### 1.3 Assessment and career guidance

| Table | Personal data |
|---|---|
| `assessment_attempts` | user id, assessment id, status, timestamps, score |
| `assessment_attempt_questions`, `assessment_answers` | which questions were served/answered; selected option |
| `skill_scores` | per-attempt skill scores and gap level |
| `assessment_tests`, `assessment_questions`, `question_options`, `careers`, `skills`, `career_skills` | Platform content, not personal (but attempts reference it) |
| `project_progress`, `roadmap_item_progress` | user id + project/roadmap item + status |
| `projects`, `roadmap_phases`, `roadmap_items` | Platform content |

### 1.4 Uploaded files and generated artifacts

| Store | Data |
|---|---|
| `cv_documents` | user id, storage key, original filename, content type, size, parse status/error, extracted candidate name/email/phone, extracted CV text |
| CV object storage | The actual PDF/DOC/DOCX. Dev: `./data/cv-storage`; prod: private S3 object under `cvs/` |
| `linkedin_profiles` | profile URL, headline, about, role, experience/skills/education text (user-entered, no scraping) |
| `ai_chat_sessions`, `ai_chat_messages` | chat title/content; may contain personal data the student typed |
| Reports | Generated live as PDFs; not persisted as rows (no report snapshot table) |
| Profile photo storage | Private object referenced by `student_profiles.profile_photo_url` |

### 1.5 External copies

These are **outside the application database** and must not be ignored when a
deletion is promised:

- MySQL backups/dumps and binlogs;
- S3 object versions, replicas, lifecycle rules, and any bucket replication;
- AI provider request/response retention (OpenAI/Gemini policies depend on the
  configured account and provider terms);
- Google identity data held by Google (not controlled by CareerOS);
- Reverse-proxy/CDN/WAF logs;
- Error-monitoring and log-aggregation platforms;
- Email provider records (no provider is configured in the repository today).

## 2. Decisions that must be approved before implementation

No code should guess these:

1. **Legal basis and purpose** for each category (account, assessment, CV,
   LinkedIn, AI chat, audit/security).
2. **Retention periods** per category, including inactive/graduated students
   and failed CV parses.
3. **Account deletion model**: immediate hard delete, soft delete + grace
   period, or anonymization. Which fields must survive (e.g., assessment
   statistics) and in what de-identified form?
4. **CV/photo/object retention**: delete immediately on account deletion, after
   a grace period, or retain under legal/security obligations? What about S3
   versioning and backups?
5. **AI chat retention**: are prompts/responses personal data that must be
   deleted? Does the provider retain them, and for how long?
6. **Audit/consent retention**: consent evidence and security audit records
   often must be retained to prove compliance. Which lawful basis applies, and
   for how long? Can they be deleted on request?
7. **DSAR/export**: what format, which fields, identity verification, response
   deadline, and whether derived analysis (readiness, gap, reports) is included.
8. **Backups**: maximum restore window; whether a deleted record may reappear
   after a restore; how deletion requests are replayed after restore.
9. **Legal hold / fraud / security incident** exceptions.
10. **Data residency and sub-processors** (database, S3, AI, email, logs).
11. **Who approves and records a deletion exception**, and how it is audited.

If the owner cannot approve these, the correct product behavior is a documented
manual process — not an automated delete endpoint that over-promises.

## 3. What is implemented today

- Durable, append-only consent evidence (`consent_records`, Flyway V2).
- Minimum audit trail for platform-admin actions and denied admin requests
  (`audit_events`, Flyway V3).
- Account deactivation now invalidates existing access/refresh tokens and
  blocks Google sign-in.
- No account-deletion endpoint, no bulk CV deletion, no DSAR export.
- No retention job. `audit_events` is not purged.
- No claim is made that data is deleted from backups, S3 versions, AI
  providers, or logs.

## 4. Proposed FK-safe deletion order (design only — not implemented)

This is the mechanical order a future authorized deletion service should use.
It is **not** a retention decision and must not be executed until section 2 is
approved. All steps must run in one database transaction where possible, with
the object-store deletes after commit and a deletion job/audit record.

1. Revoke and delete the user's `refresh_tokens`.
2. Delete AI messages, then AI sessions (child → parent).
3. Delete `assessment_answers`, `assessment_attempt_questions`,
   `skill_scores`, then `assessment_attempts` (respecting the existing
   `ON DELETE CASCADE` on attempt questions and the answer → attempt FK).
4. Delete `project_progress`, `roadmap_item_progress`.
5. Delete `linkedin_profiles`, `cv_documents`.
6. Delete or anonymize `student_profiles` (it references `users` and
   `careers`).
7. Decide `consent_records` and `audit_events` disposition under the approved
   retention/legal-hold policy. They currently have `RESTRICT` (consent) and no
   FK (audit).
8. Delete the `users` row last.
9. After commit, delete the CV and profile-photo objects from storage. Record
   the object-store result in the deletion audit; if it fails, retry and do not
   report full deletion.
10. Record the request, actor, scope, outcome, timestamp, and correlation id in
    the audit trail (without storing the deleted content).

### Why this order

- `assessment_answers` references attempts and questions.
- `skill_scores` and `assessment_attempt_questions` reference attempts.
- `consent_records` references `users` (no cascade), so it must be decided
  before deleting the user.
- `audit_events` intentionally has no FK so security history survives.
- Files are external; a DB-only delete would leave the bytes behind.

## 5. Authorization requirements for any future deletion/export

- The caller's identity must come from the authenticated principal, never a
  request-supplied user id.
- A student may delete/export only their own data.
- Platform admins must not gain implicit access to student PII; any support
  access needs a separate, explicit, time-bound, audited permission.
- Institution staff (when approved) must be scoped by verified membership, not
  by a query parameter or email domain.
- Every export/download must re-check ownership/scope; a frontend-hidden button
  is not a control.
- Deletion and export must be audited (actor, action, scope, outcome,
  correlation id) without logging the content.
- Rate-limit and CSRF-protect destructive endpoints once cookies are used.

## 6. Verification that exists today

- CV download is owner-scoped; a cross-user download returns not-found/denied
  (see the CV integration tests).
- Reports and readiness endpoints derive the student from the authenticated
  principal; there is no student-id parameter to forge.
- Admin routes require the platform `ADMIN` role; denied attempts are audited.
- There is no deletion or export endpoint to test yet.

## 7. Release impact

Account deletion and data export are **not release gates that can be marked
green**. They are blocked on owner policy decisions. This does not block
shipping the existing student/admin product if the owner accepts a documented
manual DSAR/deletion process, but it does block any claim of GDPR/DPDP
compliance or “right to erasure” automation.
