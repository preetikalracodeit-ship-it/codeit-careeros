import { AppError } from "../../lib/errors.js";
import { type CollegeScope, requirePlacementReports, requireExport } from "./collegeScope.service.js";
import { loadCohort, type StudentFilter } from "./studentEnrollment.service.js";
import { PlacementDrive, type PlacementDriveDoc } from "../../models/PlacementDrive.js";
import { PlacementApplication, type PlacementApplicationDoc } from "../../models/PlacementApplication.js";
import { recordInstitutionEvent } from "../../lib/audit.js";

const MAX_EXPORT_ROWS = 10_000;

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator * 100) / denominator);
}

function percentText(value: number | null): string {
  return value == null ? "" : `${value}%`;
}

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const DENOMINATOR_DEFINITION =
  "Active students in batches whose graduation year is the current year + 1 or earlier " +
  "(students without a graduation year are included), after applying the caller's academic scope.";

const DEFINITIONS = [
  { metric: "eligibleGraduatingStudents", definition: DENOMINATOR_DEFINITION },
  { metric: "driveParticipants", definition: "Distinct non-withdrawn applicants in the scoped placement drives." },
  { metric: "offersMade", definition: "Offer records, not distinct students. Multiple offers to one student are counted separately here." },
  { metric: "studentsWithOffer", definition: "Distinct students with at least one non-withdrawn offer." },
  { metric: "acceptedOffers", definition: "Distinct students with at least one accepted or joined offer." },
  { metric: "joinedStudents", definition: "Distinct students with a joined offer." },
  { metric: "placementRate", definition: "Joined students divided by eligible graduating students." },
  { metric: "offerRate", definition: "Students with an offer divided by eligible graduating students." },
];

async function computeSnapshot(scope: CollegeScope, filter: StudentFilter) {
  const cohort = await loadCohort(scope, filter);
  const currentYear = new Date().getFullYear();

  const eligibleGraduating = cohort.filter((row) =>
    row.enrollment.status === "ACTIVE" &&
    (row.batch.graduationYear == null || row.batch.graduationYear <= currentYear + 1)
  );

  const visibleDrives = await PlacementDrive.find({ institutionId: scope.institutionId }).lean<PlacementDriveDoc[]>();
  const visibleDriveIds = new Set(visibleDrives.map((d) => d._id));
  const driveMap = new Map(visibleDrives.map((d) => [d._id, d]));

  const profileIds = new Set(cohort.map((c) => c.profile._id));
  const applications = await PlacementApplication.find({
    institutionId: scope.institutionId,
    studentProfileId: { $in: Array.from(profileIds) },
    driveId: { $in: Array.from(visibleDriveIds) },
  }).lean<PlacementApplicationDoc[]>();

  const eligibleProfileIds = new Set(eligibleGraduating.map((e) => e.profile._id));

  const participantIds = new Set(
    applications
      .filter((app) => app.stage !== "WITHDRAWN" && eligibleProfileIds.has(app.studentProfileId))
      .map((app) => app.studentProfileId),
  );

  const offerStudentIds = new Set(
    applications
      .filter((app) => app.offer && app.offer.status !== "WITHDRAWN" && eligibleProfileIds.has(app.studentProfileId))
      .map((app) => app.studentProfileId),
  );

  const acceptedStudentIds = new Set(
    applications
      .filter((app) => app.offer && (app.offer.status === "ACCEPTED" || app.offer.status === "JOINED") && eligibleProfileIds.has(app.studentProfileId))
      .map((app) => app.studentProfileId),
  );

  const joinedStudentIds = new Set(
    applications
      .filter((app) => app.offer && app.offer.status === "JOINED" && eligibleProfileIds.has(app.studentProfileId))
      .map((app) => app.studentProfileId),
  );

  const offers = applications.flatMap((app) => (app.offer ? [app.offer] : []));

  return {
    cohort,
    eligibleGraduating,
    driveMap,
    applications,
    offers,
    participantIds,
    offerStudentIds,
    acceptedStudentIds,
    joinedStudentIds,
  };
}

export async function getPlacementAnalytics(scope: CollegeScope, filter: StudentFilter = {}) {
  requirePlacementReports(scope);
  const snap = await computeSnapshot(scope, filter);

  // Department outcomes
  const byDept = new Map<number, typeof snap.eligibleGraduating>();
  for (const row of snap.eligibleGraduating) {
    const list = byDept.get(row.department._id) ?? [];
    list.push(row);
    byDept.set(row.department._id, list);
  }

  const departmentOutcomes = Array.from(byDept.entries()).map(([departmentId, rows]) => {
    const name = rows[0]?.department.name ?? `Department #${departmentId}`;
    const deptProfiles = new Set(rows.map((r) => r.profile._id));
    const participants = Array.from(snap.participantIds).filter((id) => deptProfiles.has(id)).length;
    const offers = Array.from(snap.offerStudentIds).filter((id) => deptProfiles.has(id)).length;
    const joined = Array.from(snap.joinedStudentIds).filter((id) => deptProfiles.has(id)).length;
    const eligible = rows.length;
    return {
      departmentId,
      departmentName: name,
      eligibleGraduatingStudents: eligible,
      driveParticipants: participants,
      offers,
      joined,
      participationRate: rate(participants, eligible),
      placementRate: rate(joined, eligible),
    };
  }).sort((a, b) => a.departmentName.localeCompare(b.departmentName));

  // Company outcomes
  const byCompany = new Map<number, PlacementApplicationDoc[]>();
  for (const app of snap.applications) {
    const drive = snap.driveMap.get(app.driveId);
    if (!drive) continue;
    const companyId = drive.companyId ?? drive._id;
    const list = byCompany.get(companyId) ?? [];
    list.push(app);
    byCompany.set(companyId, list);
  }

  const companyOutcomes = Array.from(byCompany.entries()).map(([companyId, apps]) => {
    const drive = snap.driveMap.get(apps[0]?.driveId ?? 0);
    const companyName = drive?.companyName ?? `Company #${companyId}`;
    const drivesCount = new Set(apps.map((a) => a.driveId)).size;
    const offersCount = apps.filter((a) => a.offer && a.offer.status !== "WITHDRAWN").length;
    const joinedStudents = new Set(
      apps.filter((a) => a.offer && a.offer.status === "JOINED").map((a) => a.studentProfileId),
    ).size;
    return {
      companyId,
      companyName,
      drives: drivesCount,
      applications: apps.length,
      offers: offersCount,
      joined: joinedStudents,
    };
  }).sort((a, b) => a.companyName.localeCompare(b.companyName));

  // Stage counts
  const stageCountsMap: Record<string, number> = {
    REGISTERED: 0,
    SHORTLISTED: 0,
    TEST_SCHEDULED: 0,
    INTERVIEW_SCHEDULED: 0,
    OFFERED: 0,
    JOINED: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
  };
  for (const app of snap.applications) {
    stageCountsMap[app.stage] = (stageCountsMap[app.stage] ?? 0) + 1;
  }
  const stageCounts = Object.entries(stageCountsMap).map(([stage, count]) => ({
    stage,
    applications: count,
  }));

  const activeApps = snap.applications.filter(
    (app) => app.stage !== "WITHDRAWN" && app.stage !== "REJECTED",
  ).length;

  return {
    institutionName: scope.institution.name,
    denominatorDefinition: DENOMINATOR_DEFINITION,
    definitions: DEFINITIONS,
    eligibleGraduatingStudents: snap.eligibleGraduating.length,
    driveParticipants: snap.participantIds.size,
    totalApplications: snap.applications.length,
    activeApplications: activeApps,
    offersMade: snap.offers.length,
    studentsWithOffer: snap.offerStudentIds.size,
    acceptedOffers: snap.acceptedStudentIds.size,
    joinedStudents: snap.joinedStudentIds.size,
    participationRate: rate(snap.participantIds.size, snap.eligibleGraduating.length),
    offerRate: rate(snap.offerStudentIds.size, snap.eligibleGraduating.length),
    placementRate: rate(snap.joinedStudentIds.size, snap.eligibleGraduating.length),
    departmentOutcomes,
    companyOutcomes,
    stageCounts,
    generatedAt: new Date().toISOString(),
  };
}

export async function exportPlacementAnalyticsCsv(scope: CollegeScope, filter: StudentFilter = {}, type: string) {
  requirePlacementReports(scope);
  requireExport(scope);
  if (!type || !type.trim()) {
    throw AppError.badRequest("A placement report type is required");
  }

  const snap = await computeSnapshot(scope, filter);
  const normalized = type.trim().toLowerCase();

  const rows: string[][] = [];

  switch (normalized) {
    case "placement-summary": {
      rows.push(["Metric", "Value", "Definition"]);
      rows.push(["Eligible graduating students", String(snap.eligibleGraduating.length), DENOMINATOR_DEFINITION]);
      rows.push(["Drive participants", String(snap.participantIds.size), "Distinct non-withdrawn applicants in the scoped drives"]);
      rows.push(["Total applications", String(snap.applications.length), "All application records in the scoped drives"]);
      rows.push(["Offers made", String(snap.offers.length), "Offer records"]);
      rows.push(["Students with offer", String(snap.offerStudentIds.size), "Distinct students with at least one non-withdrawn offer"]);
      rows.push(["Accepted offers", String(snap.acceptedStudentIds.size), "Distinct students with an accepted or joined offer"]);
      rows.push(["Joined students", String(snap.joinedStudentIds.size), "Distinct students with a joined offer"]);
      rows.push(["Participation rate", percentText(rate(snap.participantIds.size, snap.eligibleGraduating.length)), "Participants / eligible graduating students"]);
      rows.push(["Offer rate", percentText(rate(snap.offerStudentIds.size, snap.eligibleGraduating.length)), "Students with an offer / eligible graduating students"]);
      rows.push(["Placement rate", percentText(rate(snap.joinedStudentIds.size, snap.eligibleGraduating.length)), "Joined students / eligible graduating students"]);
      break;
    }
    case "department-outcomes": {
      rows.push(["Department", "Eligible Graduating Students", "Drive Participants", "Students With Offer", "Joined Students", "Participation Rate", "Placement Rate"]);
      const analytics = await getPlacementAnalytics(scope, filter);
      for (const d of analytics.departmentOutcomes) {
        rows.push([
          d.departmentName,
          String(d.eligibleGraduatingStudents),
          String(d.driveParticipants),
          String(d.offers),
          String(d.joined),
          percentText(d.participationRate),
          percentText(d.placementRate),
        ]);
      }
      break;
    }
    case "company-outcomes": {
      rows.push(["Company", "Drives", "Applications", "Offers", "Joined Students"]);
      const analytics = await getPlacementAnalytics(scope, filter);
      for (const c of analytics.companyOutcomes) {
        rows.push([
          c.companyName,
          String(c.drives),
          String(c.applications),
          String(c.offers),
          String(c.joined),
        ]);
      }
      break;
    }
    case "stage-progress": {
      rows.push(["Stage", "Applications"]);
      const analytics = await getPlacementAnalytics(scope, filter);
      for (const s of analytics.stageCounts) {
        rows.push([s.stage, String(s.applications)]);
      }
      break;
    }
    default:
      throw AppError.badRequest(
        "Unknown placement report type. Use placement-summary, department-outcomes, company-outcomes or stage-progress.",
      );
  }

  if (rows.length - 1 > MAX_EXPORT_ROWS) {
    throw AppError.badRequest("The placement export exceeds 10,000 data rows; narrow the filters");
  }

  let csv = "\uFEFF";
  for (const row of rows) {
    csv += row.map(csvEscape).join(",") + "\r\n";
  }

  await recordInstitutionEvent({
    actorUserId: scope.userId,
    actorRole: scope.designation,
    action: "PLACEMENT_REPORT_EXPORT",
    targetType: "PLACEMENT_REPORT",
    institutionId: scope.institutionId,
    details: `type=${normalized},rows=${Math.max(0, rows.length - 1)}`,
  });

  return {
    filename: `careeros-${normalized}.csv`,
    bytes: Buffer.from(csv, "utf-8"),
  };
}

