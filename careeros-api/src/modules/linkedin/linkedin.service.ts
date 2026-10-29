import { withTransaction } from "../../lib/db.js";
import type { HydratedDocument } from "mongoose";
import { getNextSequence } from "../../models/Counter.js";
import { LinkedInProfile, type LinkedInProfileDoc } from "../../models/LinkedInProfile.js";
import { Skill } from "../../models/Skill.js";
import type { LinkedInProfileInput } from "./linkedin.schemas.js";
import { getStudentReadiness } from "../students/readiness.service.js";

function toProfileResponse(profile: LinkedInProfileDoc | HydratedDocument<LinkedInProfileDoc>) {
  const data = "toObject" in profile ? profile.toObject() as unknown as Record<string, unknown> : profile as unknown as Record<string, unknown>;
  return {
    profileId: data._id,
    profileUrl: data.profileUrl,
    ...(data.headline == null ? {} : { headline: data.headline }),
    ...(data.about == null ? {} : { about: data.about }),
    ...(data.currentRole == null ? {} : { currentRole: data.currentRole }),
    ...(data.experienceText == null ? {} : { experienceText: data.experienceText }),
    ...(data.skillsText == null ? {} : { skillsText: data.skillsText }),
    ...(data.educationText == null ? {} : { educationText: data.educationText }),
    updatedAt: data.updatedAt,
  };
}

const trimOrNull = (value: string | null | undefined) => value?.trim() || null;
const STOPWORDS = new Set([
  "administration", "administrator", "fundamentals", "fundamental", "operations", "operation", "testing", "design", "designer",
  "analysis", "analyst", "analytics", "engineering", "engineer", "development", "developer", "management", "manager",
  "language", "languages", "processing", "learning", "system", "systems", "application", "applications", "rest", "data",
  "power", "deep", "natural", "security",
]);
const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ["js", "es 6"], typescript: ["ts"], python: ["py"],
  sql: ["mysql", "postgresql", "postgres", "sqlite", "pl sql", "t sql"],
  react: ["reactjs", "react.js"], "node.js": ["nodejs", "node"], "machine learning": ["ml"],
  "deep learning": ["dl"], "natural language processing": ["nlp"], "generative ai": ["genai", "ai"],
  kubernetes: ["k 8 s"], mongodb: ["mongo"], "rest apis": ["rest api", "restful"],
  microservices: ["microservice"], java: ["core java", "j 2 ee"], aws: ["amazon web services"],
  "ci cd jenkins": ["cicd"], "api testing": ["postman"], "penetration testing": ["pentest", "pen test"],
  "data visualization": ["tableau"], "database administration": ["database administrator"],
};
const normalize = (value: string) => value.toLowerCase()
  .replace(/(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/g, " ")
  .replace(/[^a-z0-9+#.]+/g, " ").trim();
function containsWord(text: string, needle: string) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`).test(text);
}
function segmentMatches(text: string, segment: string) {
  const tokens = segment.split(/[. ]+/).filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  if (tokens.length === 0) return false;
  if (tokens.length === 1 && (tokens[0] === "cloud" || tokens[0] === "database")) return containsWord(text, segment);
  let allPresent = true;
  for (const token of tokens) {
    if (containsWord(text, token)) {
      if (token.length >= 8) return true;
    } else allPresent = false;
  }
  return allPresent;
}
function segmentsOf(raw: string) {
  const segments: string[] = [];
  const remainder = raw.replace(/\(([^()]*)\)/g, (_match, inner: string) => {
    for (const part of inner.split(/[&/]+/)) if (normalize(part)) segments.push(normalize(part));
    return " ";
  });
  for (const part of remainder.split(/[&/]+/)) if (normalize(part)) segments.push(normalize(part));
  return segments;
}
function mentions(text: string, skill: string) {
  const normalizedSkill = normalize(skill);
  if (!normalizedSkill) return false;
  if (containsWord(text, normalizedSkill)) return true;
  const compactSkill = normalizedSkill.replace(/[^a-z0-9]+/g, "");
  if (compactSkill.length >= 6 && text.replace(/[^a-z0-9]+/g, "").includes(compactSkill)) return true;
  if ((SKILL_ALIASES[normalizedSkill] ?? []).some((alias) => containsWord(text, alias))) return true;
  const segments = segmentsOf(skill);
  if (segments.length > 1) return segments.some((segment) => segmentMatches(text, segment));
  return segmentMatches(text, normalizedSkill);
}

export async function getMyLinkedInProfile(userId: number) {
  const profile = await LinkedInProfile.findOne({ userId }).lean();
  return profile ? toProfileResponse(profile as LinkedInProfileDoc) : null;
}

export async function saveLinkedInProfile(userId: number, input: LinkedInProfileInput) {
  let response: HydratedDocument<LinkedInProfileDoc> | null = null;
  const url = input.profileUrl.trim().startsWith("http") ? input.profileUrl.trim() : `https://${input.profileUrl.trim()}`;
  await withTransaction(async (session) => {
    const existing = await LinkedInProfile.findOne({ userId }).session(session);
    const profile = existing ?? new LinkedInProfile({ _id: await getNextSequence("linkedin_profiles", session), userId, profileUrl: url });
    profile.profileUrl = url;
    profile.headline = trimOrNull(input.headline);
    profile.about = trimOrNull(input.about);
    profile.currentRole = trimOrNull(input.currentRole);
    profile.experienceText = trimOrNull(input.experienceText);
    profile.skillsText = trimOrNull(input.skillsText);
    profile.educationText = trimOrNull(input.educationText);
    response = await profile.save({ session });
  });
  if (!response) throw new Error("Unable to save LinkedIn profile");
  return toProfileResponse(response);
}

export async function analyzeLinkedInProfile(userId: number) {
  const profile = await LinkedInProfile.findOne({ userId }).lean();
  if (!profile) return {
    hasProfile: false, hasTarget: false, careerId: null, careerName: null, profile: null,
    alignmentPercent: 0, detectedSkills: [], matchedSkills: [], missingSkills: [],
    alsoOnCv: [], onlyOnLinkedIn: [], onlyOnCv: [], completenessPercent: 0, strengths: [], suggestions: [],
  };
  const combined = [profile.headline, profile.about, profile.currentRole, profile.experienceText, profile.skillsText, profile.educationText].filter(Boolean).join("\n");
  const normalized = ` ${normalize(combined)} `;
  const skills = await Skill.find({ active: true }).sort({ name: 1 }).lean();
  const detectedSkills = skills.filter((skill) => mentions(normalized.trim(), skill.name)).map((skill) => ({ skillId: skill._id, skillName: skill.name, skillCategory: skill.category }));
  const readiness = await getStudentReadiness(userId);
  const detectedIds = new Set(detectedSkills.map((skill) => skill.skillId));
  const matchedSkills = readiness.hasTarget ? readiness.gaps.filter((gap) => detectedIds.has(gap.skillId)) : [];
  const missingSkills = readiness.hasTarget ? readiness.gaps.filter((gap) => !detectedIds.has(gap.skillId)) : [];
  const strengths: string[] = [];
  const suggestions: string[] = [];
  const check = (passed: boolean, strength: string, suggestion: string) => (passed ? strengths.push(strength) : suggestions.push(suggestion));
  check((profile.headline ?? "").length >= 10, "Headline present", "Write a headline naming your target role and 1–2 key skills.");
  check((profile.about ?? "").length >= 150, "About section has substance", "Expand About to a short paragraph: who you are, what you build, what you want next.");
  check(Boolean(profile.experienceText?.trim()), "Experience listed", "Add Experience entries — recruiters filter on them.");
  check(Boolean(profile.educationText?.trim()), "Education listed", "Add your Education — many roles require it.");
  check(detectedSkills.length >= 3, `${detectedSkills.length} skills detected`, "List at least 3 skills explicitly so they get detected and matched.");
  if (readiness.hasTarget) {
    if (missingSkills.length === 0 && readiness.totalSkills > 0) strengths.push(`Every required ${readiness.targetCareerName} skill is on your profile`);
    else if (missingSkills.length) suggestions.push(`Add these required skills to your profile: ${missingSkills.slice(0, 3).map((gap) => gap.skillName).join(", ")}${missingSkills.length > 3 ? `, and ${missingSkills.length - 3} more.` : "."}`);
  } else suggestions.push("Choose a target career to compare your profile against what employers expect.");
  const frameworkSize = matchedSkills.length + missingSkills.length;
  const totalChecks = strengths.length + suggestions.length;
  return {
    hasProfile: true, hasTarget: readiness.hasTarget,
    careerId: readiness.targetCareerId ?? null, careerName: readiness.targetCareerName ?? null,
    profile: toProfileResponse(profile as unknown as LinkedInProfileDoc),
    alignmentPercent: frameworkSize ? Math.round(matchedSkills.length * 100 / frameworkSize) : 0,
    detectedSkills, matchedSkills, missingSkills,
    // CV comparison stays empty until CV storage/analysis is migrated.
    alsoOnCv: [], onlyOnLinkedIn: detectedSkills, onlyOnCv: [],
    completenessPercent: totalChecks ? Math.round(strengths.length * 100 / totalChecks) : 0,
    strengths, suggestions,
  };
}
