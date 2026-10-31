import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api.js";
import { auth } from "../lib/auth.js";

const EMPTY = {
  fullName: "", mobile: "", dateOfBirth: "", college: "", degree: "", branch: "",
  graduationYear: "", semester: "", location: "", githubUrl: "", linkedinUrl: "", portfolioUrl: "",
};
const CHECKLIST = [
  ["fullName", "Full name"], ["mobile", "Mobile number"], ["college", "College"],
  ["degree", "Degree"], ["branch", "Branch"], ["graduationYear", "Graduation year"],
  ["semester", "Semester"], ["linkedinUrl", "LinkedIn URL"],
];
const DEGREES = ["BTech", "BE", "BSc", "BCA", "MTech", "ME", "MCA", "MBA", "Other"];

function fromProfile(data) {
  return {
    ...EMPTY,
    fullName: data.fullName || "", mobile: data.mobile || "", dateOfBirth: data.dateOfBirth || "",
    college: data.college || "", degree: data.degree || "", branch: data.branch || "",
    graduationYear: data.graduationYear ? String(data.graduationYear) : "",
    semester: data.semester ? String(data.semester) : "", location: data.location || "",
    githubUrl: data.githubUrl || "", linkedinUrl: data.linkedinUrl || "", portfolioUrl: data.portfolioUrl || "",
  };
}

function toPayload(form) {
  return {
    fullName: form.fullName.trim(), mobile: form.mobile.trim() || null,
    dateOfBirth: form.dateOfBirth || null, college: form.college.trim() || null,
    degree: form.degree || null, branch: form.branch.trim() || null,
    graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
    semester: form.semester ? Number(form.semester) : null, location: form.location.trim() || null,
    githubUrl: form.githubUrl.trim() || null, linkedinUrl: form.linkedinUrl.trim() || null,
    portfolioUrl: form.portfolioUrl.trim() || null,
  };
}

function initials(name) {
  return (name || auth.getUser()?.email || "U").split(/[\s@._]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function Field({ label, name, form, errors, onChange, type = "text", ...props }) {
  const id = `profile-${name}`;
  return <label className="profile-field" htmlFor={id}>{label}<input id={id} name={name} type={type} value={form[name]} onChange={onChange} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${id}-error` : undefined} {...props} />{errors[name] && <span className="field-error" id={`${id}-error`}>{errors[name]}</span>}</label>;
}

export function StudentProfilePage() {
  const [form, setForm] = useState(EMPTY);
  const [savedForm, setSavedForm] = useState(EMPTY);
  const [updatedAt, setUpdatedAt] = useState("");
  const [photoKey, setPhotoKey] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm), [form, savedForm]);
  const completion = useMemo(() => Math.round(CHECKLIST.filter(([key]) => String(form[key] || "").trim()).length * 100 / CHECKLIST.length), [form]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get("/students/me");
      const initial = fromProfile(data);
      setForm(initial);
      setSavedForm(initial);
      setUpdatedAt(data.updatedAt || "");
      setPhotoKey(data.profilePhotoUrl || null);
    } catch (reason) {
      setLoadError(reason.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    let objectUrl;
    if (!photoKey) {
      setPhotoUrl(null);
      return undefined;
    }
    api.get("/students/me/photo", { responseType: "blob" }).then((blob) => {
      if (!active || !blob?.size) return;
      objectUrl = URL.createObjectURL(blob);
      setPhotoUrl(objectUrl);
    }).catch(() => {
      if (active) setPhotoUrl(null);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoKey]);

  function change(event) {
    const { name } = event.target;
    let { value } = event.target;
    if (name === "mobile") value = value.replace(/\D/g, "").slice(0, 10);
    if (name === "graduationYear") value = value.replace(/\D/g, "").slice(0, 4);
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    if (form.mobile && !/^[6-9]\d{9}$/.test(form.mobile)) next.mobile = "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.";
    if (form.graduationYear) {
      const year = Number(form.graduationYear);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) next.graduationYear = "Enter a year from 2000 to 2100.";
    }
    return next;
  }

  async function save(event) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.put("/students/me", toPayload(form));
      const normalized = fromProfile(updated);
      setForm(normalized);
      setSavedForm(normalized);
      setUpdatedAt(updated.updatedAt || "");
      const stored = auth.getUser();
      if (stored) auth.save({ accessToken: auth.getAccessToken(), refreshToken: auth.getRefreshToken(), user: { ...stored, fullName: updated.fullName } });
      window.dispatchEvent(new CustomEvent("careeros:profile-updated"));
      toast.success("Profile saved.");
    } catch (reason) {
      const fieldErrors = Object.fromEntries((reason.fieldErrors || []).map((item) => [item.field, item.message]));
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      toast.error(reason.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Choose a JPG, PNG or WebP photo.");
    if (file.size > 2 * 1024 * 1024) return toast.error("Photo must be at most 2 MB.");
    const data = new FormData();
    data.append("file", file);
    setPhotoBusy(true);
    try {
      const result = await api.post("/students/me/photo", data);
      setPhotoKey(result.profilePhotoUrl || null);
      window.dispatchEvent(new CustomEvent("careeros:profile-updated"));
      toast.success("Profile photo updated.");
    } catch (reason) {
      toast.error(reason.message || "Unable to upload this photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      const result = await api.delete("/students/me/photo");
      setPhotoKey(result.profilePhotoUrl || null);
      window.dispatchEvent(new CustomEvent("careeros:profile-updated"));
      toast.success("Profile photo removed.");
    } catch (reason) {
      toast.error(reason.message || "Unable to remove this photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  if (loading) return <main className="workspace-page"><div className="notice-card" role="status">Loading your profile…</div></main>;
  if (loadError) return <main className="workspace-page"><header className="workspace-heading"><div><span className="eyebrow">STUDENT PROFILE</span><h1>Couldn’t load your profile.</h1><p className="muted">{loadError}</p></div></header><button className="secondary-button" onClick={load}>Try again</button></main>;

  return <main className="workspace-page profile-page">
    <header className="workspace-heading"><div><span className="eyebrow">STUDENT PROFILE</span><h1>My profile</h1><p className="muted">Keep your personal, education and career details up to date. They help CareerOS tailor your analysis.</p></div><Link className="secondary-button" to="/student/dashboard">Dashboard</Link></header>
    <div className="profile-layout">
      <aside className="profile-aside">
        <section className="profile-card profile-person"><div className="profile-avatar">{photoUrl ? <img src={photoUrl} alt={`${form.fullName || "Your"} profile`} /> : <span>{initials(form.fullName)}</span>}</div><strong>{form.fullName || "Your name"}</strong><p>{photoKey ? "Your photo appears across CareerOS." : "Add a photo for your profile."}</p><input ref={fileRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload profile photo" onChange={uploadPhoto} /><div className="photo-actions"><button type="button" className="secondary-button" disabled={photoBusy} onClick={() => fileRef.current?.click()}>{photoBusy ? "Working…" : photoKey ? "Change photo" : "Upload photo"}</button>{photoKey && <button type="button" className="text-button" disabled={photoBusy} onClick={removePhoto}>Remove</button>}</div><small>JPG, PNG or WebP · max 2 MB</small></section>
        <section className="profile-card completeness-card"><span className="completeness-ring" style={{ "--completion": `${completion}%` }}><strong>{completion}%</strong></span><strong>Profile completeness</strong><p>{completion === 100 ? "Ready for analysis." : "Complete the checklist to improve your profile."}</p></section>
        <details className="profile-card checklist-card"><summary>Completion checklist <span>{completion}%</span></summary><ul>{CHECKLIST.map(([key, label]) => <li key={key}><span className={form[key] ? "check-mark" : "empty-mark"}>{form[key] ? "✓" : "·"}</span>{label}</li>)}</ul></details>
      </aside>
      <form className="profile-form" onSubmit={save} noValidate>
        {dirty && <div className="notice-card unsaved-notice" role="status">You have unsaved changes.</div>}
        <section className="profile-card"><div className="profile-section-heading"><h2>Personal information</h2><p>Your name and contact basics.</p></div><div className="profile-fields">
          <Field label="Full name" name="fullName" form={form} errors={errors} onChange={change} required maxLength={120} />
          <Field label="Mobile" name="mobile" form={form} errors={errors} onChange={change} type="tel" inputMode="numeric" maxLength={10} placeholder="9876543210" />
          <Field label="Date of birth" name="dateOfBirth" form={form} errors={errors} onChange={change} type="date" />
          <Field label="Location" name="location" form={form} errors={errors} onChange={change} placeholder="City, State" />
        </div></section>
        <section className="profile-card"><div className="profile-section-heading"><h2>Education</h2><p>College, degree, branch and graduation details.</p></div><div className="profile-fields">
          <Field label="College / University" name="college" form={form} errors={errors} onChange={change} className="field-wide" placeholder="Your college" />
          <label className="profile-field" htmlFor="profile-degree">Degree<select id="profile-degree" name="degree" value={form.degree} onChange={change}><option value="">Select degree</option>{DEGREES.map((degree) => <option key={degree}>{degree}</option>)}</select></label>
          <Field label="Branch" name="branch" form={form} errors={errors} onChange={change} placeholder="Computer Science" />
          <Field label="Graduation year" name="graduationYear" form={form} errors={errors} onChange={change} inputMode="numeric" maxLength={4} placeholder="2027" />
          <label className="profile-field" htmlFor="profile-semester">Current semester<select id="profile-semester" name="semester" value={form.semester} onChange={change}><option value="">Select semester</option>{Array.from({ length: 8 }, (_, index) => String(index + 1)).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}</select></label>
        </div></section>
        <section className="profile-card"><div className="profile-section-heading"><h2>Career links</h2><p>Where recruiters and your analysis can find you online.</p></div><div className="profile-fields profile-fields-single">
          <Field label="LinkedIn URL" name="linkedinUrl" form={form} errors={errors} onChange={change} type="url" placeholder="https://linkedin.com/in/…" />
          <Field label="GitHub URL" name="githubUrl" form={form} errors={errors} onChange={change} type="url" placeholder="https://github.com/…" />
          <Field label="Portfolio URL" name="portfolioUrl" form={form} errors={errors} onChange={change} type="url" placeholder="https://…" />
        </div></section>
        <div className="profile-submit"><span>Last updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</span><button className="secondary-button" type="button" disabled={saving || !dirty} onClick={() => { setForm(savedForm); setErrors({}); }}>Cancel</button><button className="primary-button" type="submit" disabled={saving || !dirty}>{saving ? "Saving…" : "Save changes"}</button></div>
      </form>
    </div>
  </main>;
}
