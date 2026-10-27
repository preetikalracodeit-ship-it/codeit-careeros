# CareerOS — Dependency Security

> Status: scanning is wired into CI but has **not** been executed on the
> repository host. Do not claim “no backend vulnerabilities” until the CI job
> completes against the tested commit.

## 1. Frontend

- `npm ci` installs exactly `careeros-frontend/package-lock.json`.
- CI runs `npm audit --audit-level=high`; a high or critical advisory fails the
  job.
- The previous local run reported `found 0 vulnerabilities` at that threshold.
- `npm audit` covers the npm dependency graph (direct and transitive) for the
  lockfile. It is not a source-code scan.

## 2. Backend

### 2.1 Tool and scope

- Tool: OWASP Dependency-Check Maven plugin, **pinned to 12.2.2**.
- Profile: `sca` in `careeros-backend/pom.xml`; not part of the default
  `mvn verify`, so normal builds stay fast and offline-friendly.
- Scope: Maven compile/runtime dependencies, direct and transitive. Test-scope
  dependencies are excluded (`skipTestScope=true`) because they are not shipped
  in the runtime image; they can be scanned separately if required.
- Formats: HTML, JSON, and SARIF. SARIF is uploaded to GitHub code scanning so
  findings are visible on the PR/security tab.
- The resolved dependency tree is written to `target/dependency-tree.txt` and
  uploaded as a CI artifact for review.

### 2.2 Why 12.2.2, not 13.0.0

Dependency-Check 13.0.0 aborts with
`NvdApiException: Invalid API Key, length of 0` when no NVD API key is
configured (a known regression). Pinning 12.2.2 allows the scan to run with the
public NVD rate limit. Re-evaluate the pin only after reproducing a successful
no-key scan on the newer version.

### 2.3 Failure threshold

- `failBuildOnCVSS=7` — CVSS **7.0 or higher (HIGH/CRITICAL)** fails the job.
- Medium/low findings are reported but do not block.
- A scan error (NVD unavailable, malformed report) also fails the job; a green
  job therefore means the scan actually ran.

### 2.4 NVD API key handling

- The key is optional and is read only from the `NVD_API_KEY` environment
  variable (`nvdApiKeyEnvironmentVariable` in the POM).
- CI exports it only when the `NVD_API_KEY` secret is non-empty. Passing an
  empty value breaks the NVD client, so the workflow prints only
  `configured`/`not configured`.
- The key is never written to the POM, a report, an artifact, a log line, or
  the repository. Rotate it if it is ever exposed.
- Without a key the scan is slower but still runs (public NVD rate limit).

## 3. CI job

`.github/workflows/ci.yml` → `backend-sca`:

```bash
mvn -B -Psca -DskipTests compile org.owasp:dependency-check-maven:check
```

- Java 21, Maven cache, `timeout-minutes: 30`.
- `permissions: security-events: write` for SARIF upload; all other jobs remain
  `contents: read`.
- Runs on pull requests, pushes to `main`, and manual dispatch.
- No deployment secrets are available to the job.

## 4. Exception process

1. Investigate the reported CVE: confirm the dependency/version, whether the
   vulnerable code path is reachable, and whether a fixed version exists.
2. Prefer upgrading to a fixed version. If the fix requires a major upgrade,
   schedule it and document the risk in the change description.
3. If a suppression is justified, add it to
   `careeros-backend/dependency-check-suppressions.xml` with:
   - the exact CVE and dependency coordinates;
   - a written justification (false positive or unreachable code path);
   - an owner and an `until` date (maximum 90 days);
   - a link to the tracking issue.
4. Never use `<cvssBelow>` blanket suppressions, never suppress a reachable
   HIGH/CRITICAL, and never suppress a finding merely to obtain a green build.
5. Expired suppressions are treated as findings; re-review and remove them.
6. A release with an open reachable HIGH/CRITICAL is **NO-GO** regardless of the
   suppression file.

## 5. Reproducibility

- Plugin version is pinned in the POM.
- Spring Boot’s BOM controls Spring dependency versions; explicit versions are
  used for JJWT, Spring AI, and other direct dependencies.
- Maven Central is the only artifact source in CI.
- The dependency tree artifact records exactly what was resolved for the
  tested commit.
- The frontend uses `npm ci` with a committed lockfile.

## 6. Current evidence

| Check | Result |
|---|---|
| Frontend `npm audit --audit-level=high` | 0 vulnerabilities at the previous local run |
| Backend OWASP scan (local) | **Blocked by environment**: the 13.0.0 attempt failed on the empty-key regression; the 12.2.2 attempt could not start analysis because `api.nvd.nist.gov` does not resolve from this machine. No local vulnerability result is claimed. |
| Backend OWASP scan (CI) | **Not executed on the repository host** |
| GitHub code-scanning SARIF upload | Wired, not yet observed |

If the local scan is incomplete or blocked, this document and the release
report must say so. A partial scan is not proof of a clean backend.
