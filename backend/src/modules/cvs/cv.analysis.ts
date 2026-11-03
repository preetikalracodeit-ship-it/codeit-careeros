import { emailEvidence, phoneEvidence, skillMentioned, normalizeSkillText } from "../../lib/cv-text.js";

export interface CvSection {
  key: string;
  title: string;
  passed: boolean;
  note: string;
  evidence: string;
}

export interface CvCompleteness {
  scorePercent: number;
  totalChecks: number;
  passedChecks: number;
  strengths: string[];
  suggestions: string[];
}

interface SectionHit {
  present: boolean;
  evidence: string;
}

const HEADINGS: Record<string, string[]> = {
  summary: ["professional summary", "profile summary", "career summary", "summary", "profile", "objective", "career objective", "about me"],
  skills: ["technical skills", "core skills", "key skills", "skills", "core competencies", "competencies", "technologies"],
  experience: ["professional experience", "work experience", "experience", "employment history", "internships", "internship experience", "career history"],
  education: ["education", "academic background", "academic details", "qualifications", "educational qualifications"],
  projects: ["projects", "academic projects", "personal projects", "key projects", "project experience"],
  certifications: ["certifications", "certificates", "courses", "licenses", "certifications and courses", "training"],
};

function headingHit(text: string, headings: string[]): SectionHit {
  const lines = text.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length > 90) continue;
    const lower = line.toLowerCase();
    for (const heading of headings) {
      const normalizedHeading = heading.toLowerCase();
      const starts = lower === normalizedHeading
        || lower.startsWith(`${normalizedHeading} `)
        || new RegExp(`^${escapeRegExp(normalizedHeading)}\\s*[:|]`).test(lower);
      const inline = new RegExp(`(^|\\s)${escapeRegExp(normalizedHeading)}\\s*[:|]`).test(lower)
        && line.length <= 100;
      if (starts || inline) {
        return { present: true, evidence: truncateEvidence(line) };
      }
    }
  }
  return { present: false, evidence: "" };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncateEvidence(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function firstMatchLine(text: string, pattern: RegExp): string {
  for (const line of text.split("\n")) {
    if (pattern.test(line)) return truncateEvidence(line);
  }
  return "";
}

function detectSkills(text: string): SectionHit {
  const heading = headingHit(text, HEADINGS.skills!);
  if (heading.present) return heading;
  const tech = /(javascript|typescript|python|java|react|node|sql|mongodb|docker|kubernetes|git|html|css|aws|azure|spring|django|flask|figma|excel|tableau|power bi|linux)/i;
  const match = firstMatchLine(text, tech);
  return match ? { present: true, evidence: match } : { present: false, evidence: "" };
}

function detectExperience(text: string): SectionHit {
  const heading = headingHit(text, HEADINGS.experience!);
  if (heading.present) return heading;
  const content = /(intern|internship|software engineer|developer|analyst|engineer|worked at|experience)[^\n]{0,80}(20\d{2}|present)/i;
  const match = firstMatchLine(text, content);
  return match ? { present: true, evidence: match } : { present: false, evidence: "" };
}

function detectEducation(text: string): SectionHit {
  const heading = headingHit(text, HEADINGS.education!);
  if (heading.present) return heading;
  const content = /(b\.?tech|b\.?e\.?|bachelor|master|m\.?tech|bsc|b\.?sc|degree|university|college|institute)[^\n]{0,80}(20\d{2})/i;
  const match = firstMatchLine(text, content);
  return match ? { present: true, evidence: match } : { present: false, evidence: "" };
}

function detectProjects(text: string): SectionHit {
  const heading = headingHit(text, HEADINGS.projects!);
  if (heading.present) return heading;
  const content = /(project|built|developed|designed|deployed)[^\n]{0,100}/i;
  const match = firstMatchLine(text, content);
  return match ? { present: true, evidence: match } : { present: false, evidence: "" };
}

function detectCertifications(text: string): SectionHit {
  const heading = headingHit(text, HEADINGS.certifications!);
  if (heading.present) return heading;
  const content = /(certified|certification|certificate|course|training|udemy|coursera|nptel)[^\n]{0,100}/i;
  const match = firstMatchLine(text, content);
  return match ? { present: true, evidence: match } : { present: false, evidence: "" };
}

function detectSummary(text: string): SectionHit {
  const heading = headingHit(text, HEADINGS.summary!);
  if (heading.present) return heading;
  const firstBlock = text.split("\n").slice(0, 8).join(" ");
  const match = /(motivated|passionate|aspiring|seeking|enthusiastic|detail-oriented)[^.]{10,200}\./i.exec(firstBlock);
  return match ? { present: true, evidence: truncateEvidence(match[0]) } : { present: false, evidence: "" };
}

export function cvCompleteness(text: string): CvCompleteness {
  const strengths: string[] = [];
  const suggestions: string[] = [];
  const check = (passed: boolean, strength: string, suggestion: string) => {
    if (passed) strengths.push(strength);
    else suggestions.push(suggestion);
  };
  check(detectEducation(text).present, "Education section found", "Add an Education section with your degree, college and year.");
  check(detectExperience(text).present, "Experience section found", "Add an Experience or Internship section with what you built and delivered.");
  check(detectProjects(text).present, "Projects section found", "Add a Projects section - recruiters look for proof of applied skills.");
  check(detectSkills(text).present, "Skills section found", "Add a Skills section listing the tools and technologies you know.");
  check(detectCertifications(text).present, "Certifications or courses found", "Add Certifications or Courses to stand out from other applicants.");
  check(Boolean(emailEvidence(text)), "Contact email found", "Add a contact email so recruiters can reach you.");
  check(text.trim().length >= 500, "Good detail level", "Add more detail - strong CVs describe outcomes, not just duties.");
  const total = strengths.length + suggestions.length;
  return {
    scorePercent: total === 0 ? 0 : Math.round((strengths.length * 100) / total),
    totalChecks: total,
    passedChecks: strengths.length,
    strengths,
    suggestions,
  };
}

export function cvSections(text: string): CvSection[] {
  const email = emailEvidence(text);
  const phone = phoneEvidence(text);
  const summary = detectSummary(text);
  const skills = detectSkills(text);
  const experience = detectExperience(text);
  const education = detectEducation(text);
  const projects = detectProjects(text);
  const certifications = detectCertifications(text);
  const core = [summary, skills, experience, education, projects].filter((hit) => hit.present).length;
  const structured = text.trim().length >= 500 && core >= 3;

  return [
    {
      key: "contact",
      title: "Contact Information",
      passed: Boolean(email && phone),
      note: email && phone
        ? "Email and phone found - recruiters can reach you."
        : !email && !phone
          ? "Add a contact email and phone number at the top of your CV."
          : !email
            ? "Add a contact email so recruiters can reach you."
            : "Add a phone number so recruiters can reach you.",
      evidence: [email, phone].filter(Boolean).join(" | "),
    },
    {
      key: "summary",
      title: "Professional Summary",
      passed: summary.present,
      note: summary.present
        ? "Summary section found - it frames who you are in seconds."
        : "Add a 2-3 line professional summary: who you are, key skills, what you want next.",
      evidence: summary.evidence,
    },
    {
      key: "skills",
      title: "Skills",
      passed: skills.present,
      note: skills.present
        ? "Skills section found and matched against the CareerOS skill catalog."
        : "Add a Skills section listing the tools and technologies you know.",
      evidence: skills.evidence,
    },
    {
      key: "experience",
      title: "Experience",
      passed: experience.present,
      note: experience.present
        ? "Experience section found - describe outcomes, not just duties."
        : "Add an Experience or Internship section with what you built and delivered.",
      evidence: experience.evidence,
    },
    {
      key: "education",
      title: "Education",
      passed: education.present,
      note: education.present
        ? "Education section found with degree and college details."
        : "Add an Education section with your degree, college and year.",
      evidence: education.evidence,
    },
    {
      key: "projects",
      title: "Projects",
      passed: projects.present,
      note: projects.present
        ? "Projects section found - recruiters look for proof of applied skills."
        : "Add a Projects section - recruiters look for proof of applied skills.",
      evidence: projects.evidence,
    },
    {
      key: "certifications",
      title: "Certifications",
      passed: certifications.present,
      note: certifications.present
        ? "Certifications or courses found."
        : "Add Certifications or Courses to stand out from other applicants.",
      evidence: certifications.evidence,
    },
    {
      key: "structure",
      title: "Resume Structure",
      passed: structured,
      note: structured
        ? "Good detail level with clear sections a recruiter can skim."
        : "Add more detail across at least three sections - strong CVs describe outcomes.",
      evidence: `${core} of 5 core sections present${structured ? `, ${text.trim().length} characters of detail` : ""}`,
    },
  ];
}

export function cvAtsScore(text: string): number {
  let passed = 0;
  if (emailEvidence(text)) passed += 1;
  if (phoneEvidence(text)) passed += 1;
  if (detectSkills(text).present) passed += 1;
  if (detectExperience(text).present) passed += 1;
  if (detectEducation(text).present) passed += 1;
  if (text.trim().length >= 300) passed += 1;
  return Math.round((passed * 100) / 6);
}

export function detectedSkillsFromText(text: string, skills: { _id: number; name: string; category: string }[]) {
  const normalized = normalizeSkillText(text);
  return skills
    .filter((skill) => skillMentioned(normalized, skill.name))
    .map((skill) => ({ skillId: skill._id, skillName: skill.name, skillCategory: skill.category }));
}
