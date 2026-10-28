import { useEffect, useRef, useState } from "react";
import { Camera, Save, Trash2, UserRound } from "lucide-react";
import api from "../lib/api.js";
import { auth } from "../lib/auth.js";

const EMPTY = {
  fullName: "", mobile: "", dateOfBirth: "", college: "", degree: "", branch: "",
  graduationYear: "", semester: "", location: "", githubUrl: "", linkedinUrl: "", portfolioUrl: "",
};

function formFromProfile(profile) {
  return Object.fromEntries(Object.keys(EMPTY).map((key) => [key, profile?.[key] == null ? "" : String(profile[key])]));
}

export default function StudentProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);

  useEffect(() => {
    let active = true;
    api.get("/students/me").then((data) => {
      if (!active) return;
      setProfile(data);
      setForm(formFromProfile(data));
    }).catch((requestError) => {
      if (active) setError(requestError.message || "Could not load your profile.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl;
    if (!profile?.profilePhotoUrl) {
      setPhotoUrl(null);
      return undefined;
    }
    api.get("/students/me/photo", { responseType: "blob" }).then((blob) => {
      if (!active || !blob?.size) return;
      objectUrl = URL.createObjectURL(blob);
      setPhotoUrl(objectUrl);
    }).catch(() => { if (active) setPhotoUrl(null); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile?.profilePhotoUrl, photoVersion]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === "mobile" ? value.replace(/\D/g, "").slice(0, 10) : value }));
    setError("");
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!form.fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (form.mobile && !/^[6-9][0-9]{9}$/.test(form.mobile)) {
      setError("Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.");
      return;
    }
    if (form.graduationYear && (!/^\d{4}$/.test(form.graduationYear) || Number(form.graduationYear) < 2000 || Number(form.graduationYear) > 2100)) {
      setError("Enter a valid graduation year between 2000 and 2100.");
      return;
    }
    if (form.semester && (!/^\d+$/.test(form.semester) || Number(form.semester) < 1 || Number(form.semester) > 12)) {
      setError("Semester must be between 1 and 12.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const data = await api.put("/students/me", {
        ...form,
        fullName: form.fullName.trim(),
        mobile: form.mobile || null,
        dateOfBirth: form.dateOfBirth || null,
        college: form.college.trim() || null,
        degree: form.degree.trim() || null,
        branch: form.branch.trim() || null,
        graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
        semester: form.semester ? Number(form.semester) : null,
        location: form.location.trim() || null,
        githubUrl: form.githubUrl.trim() || null,
        linkedinUrl: form.linkedinUrl.trim() || null,
        portfolioUrl: form.portfolioUrl.trim() || null,
      });
      setProfile(data);
      setForm(formFromProfile(data));
      const savedUser = auth.getUser();
      if (savedUser) auth.save({ accessToken: auth.getAccessToken(), refreshToken: auth.getRefreshToken(), user: { ...savedUser, fullName: data.fullName } });
    } catch (requestError) {
      setError(requestError.message || "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Photo must be at most 2 MB.");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setPhotoBusy(true);
    setError("");
    try {
      const data = await api.post("/students/me/photo", body);
      setProfile(data);
      setPhotoVersion((version) => version + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not upload your photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    setError("");
    try {
      const data = await api.delete("/students/me/photo");
      setProfile(data);
      setPhotoVersion((version) => version + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not remove your photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  if (loading) return <section className="page-card" role="status">Loading your profile…</section>;
  if (!profile) return <section className="page-card"><h1>Profile unavailable</h1><p role="alert">{error}</p></section>;

  return <section className="profile-page">
    <header className="profile-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>Profile</h1><p className="muted">Keep your personal and education details up to date.</p></div>
      <div className="profile-photo-block"><div className="profile-avatar">{photoUrl ? <img src={photoUrl} alt="Your profile"/> : <UserRound size={28} aria-hidden="true"/>}</div><div className="profile-photo-actions"><button className="button button-quiet" type="button" disabled={photoBusy} onClick={() => fileInput.current?.click()}><Camera size={15}/>{photoBusy ? "Working…" : profile.profilePhotoUrl ? "Change photo" : "Add photo"}</button>{profile.profilePhotoUrl && <button className="icon-button" type="button" aria-label="Remove profile photo" title="Remove photo" disabled={photoBusy} onClick={removePhoto}><Trash2 size={16}/></button>}<input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto}/></div><small>JPG, PNG or WebP · max 2 MB</small></div>
    </header>
    {error && <p className="form-error profile-error" role="alert">{error}</p>}
    <form className="profile-form" onSubmit={saveProfile}>
      <div className="profile-section"><h2>Personal details</h2><div className="profile-fields">
        <label>Full name<input name="fullName" autoComplete="name" maxLength={120} required value={form.fullName} onChange={update}/></label>
        <label>Email<input value={profile.email || ""} readOnly aria-readonly="true"/></label>
        <label>Mobile number<input name="mobile" type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} value={form.mobile} onChange={update}/></label>
        <label>Date of birth<input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update}/></label>
        <label>Location<input name="location" maxLength={150} value={form.location} onChange={update}/></label>
      </div></div>
      <div className="profile-section"><h2>Education</h2><div className="profile-fields">
        <label>College<input name="college" maxLength={150} value={form.college} onChange={update}/></label>
        <label>Degree<input name="degree" maxLength={100} value={form.degree} onChange={update}/></label>
        <label>Branch<input name="branch" maxLength={100} value={form.branch} onChange={update}/></label>
        <label>Graduation year<input name="graduationYear" type="number" min="2000" max="2100" value={form.graduationYear} onChange={update}/></label>
        <label>Semester<input name="semester" type="number" min="1" max="12" value={form.semester} onChange={update}/></label>
      </div></div>
      <div className="profile-section"><h2>Professional links</h2><div className="profile-fields">
        <label>GitHub URL<input name="githubUrl" type="url" maxLength={250} value={form.githubUrl} onChange={update}/></label>
        <label>LinkedIn URL<input name="linkedinUrl" type="url" maxLength={250} value={form.linkedinUrl} onChange={update}/></label>
        <label>Portfolio URL<input name="portfolioUrl" type="url" maxLength={250} value={form.portfolioUrl} onChange={update}/></label>
      </div></div>
      <footer className="profile-form-footer"><span className="muted">Student ID: {profile.studentId}</span><button className="button button-primary" type="submit" disabled={saving}><Save size={16}/>{saving ? "Saving…" : "Save profile"}</button></footer>
    </form>
  </section>;
}
