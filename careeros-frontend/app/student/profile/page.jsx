"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Camera, CheckCircle2, Loader2, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { Breadcrumb } from "@/components/breadcrumb";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import api from "@/lib/api";
import { auth } from "@/lib/auth";
import { useStudentPhoto } from "@/lib/profile-photo";

const emptyForm = {
  fullName: "",
  mobile: "",
  dateOfBirth: "",
  college: "",
  degree: "",
  branch: "",
  graduationYear: "",
  semester: "",
  location: "",
  githubUrl: "",
  linkedinUrl: "",
  portfolioUrl: "",
};

const checklist = [
  { key: "fullName", label: "Full name" },
  { key: "mobile", label: "Mobile number" },
  { key: "college", label: "College" },
  { key: "degree", label: "Degree" },
  { key: "branch", label: "Branch" },
  { key: "graduationYear", label: "Graduation year" },
  { key: "semester", label: "Semester" },
  { key: "linkedinUrl", label: "LinkedIn URL" },
];

const degreeOptions = [
  { value: "", label: "Select degree" },
  { value: "BTech", label: "BTech" },
  { value: "BE", label: "BE" },
  { value: "BSc", label: "BSc" },
  { value: "BCA", label: "BCA" },
  { value: "MTech", label: "MTech" },
  { value: "ME", label: "ME" },
  { value: "MCA", label: "MCA" },
  { value: "MBA", label: "MBA" },
  { value: "Other", label: "Other" },
];

const semesterOptions = [
  { value: "", label: "Select semester" },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: `Semester ${n}` })),
];

function computeCompletion(form) {
  if (!form) return 0;
  const filled = checklist.filter((item) => String(form[item.key] || "").trim().length > 0).length;
  return Math.round((filled / checklist.length) * 100);
}

function toPayload(form) {
  return {
    ...form,
    fullName: form.fullName.trim(),
    mobile: form.mobile.trim() || null,
    college: form.college.trim() || null,
    degree: form.degree || null,
    branch: form.branch.trim() || null,
    location: form.location.trim() || null,
    graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
    semester: form.semester ? Number(form.semester) : null,
    githubUrl: form.githubUrl.trim() || null,
    linkedinUrl: form.linkedinUrl.trim() || null,
    portfolioUrl: form.portfolioUrl.trim() || null,
    dateOfBirth: form.dateOfBirth || null,
  };
}

function fromProfile(data) {
  return {
    fullName: data.fullName || "",
    mobile: data.mobile || "",
    dateOfBirth: data.dateOfBirth || "",
    college: data.college || "",
    degree: data.degree || "",
    branch: data.branch || "",
    graduationYear: data.graduationYear ? String(data.graduationYear) : "",
    semester: data.semester ? String(data.semester) : "",
    location: data.location || "",
    githubUrl: data.githubUrl || "",
    linkedinUrl: data.linkedinUrl || "",
    portfolioUrl: data.portfolioUrl || "",
  };
}

export default function ProfilePage() {
  const [form, setForm] = useState(emptyForm);
  const [original, setOriginal] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [photoKey, setPhotoKey] = useState(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const fileRef = useRef(null);
  const firstLoad = useRef(true);
  const photoUrl = useStudentPhoto(photoKey, photoVersion);

  useEffect(() => {
    if (auth.getUser()?.fullName && firstLoad.current) {
      firstLoad.current = false;
      setForm((f) => ({ ...f, fullName: auth.getUser().fullName }));
    }
  }, []);

  const load = useCallback(async () => {
    setLoadingProfile(true);
    setLoadError(null);
    try {
      const data = await api.get("/students/me");
      const initial = fromProfile(data);
      setForm(initial);
      setOriginal({ ...initial, updatedAt: data.updatedAt });
      setPhotoKey(data.profilePhotoUrl || null);
    } catch (err) {
      setLoadError(err.message || "Failed to load your profile.");
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing async profile loader; state updates happen in promise callbacks
    load();
  }, [load]);

  // Indian mobile numbers: exactly 10 digits, starting with 6, 7, 8 or 9.
  function handleChange(e) {
    const { name } = e.target;
    let value = e.target.value;
    if (name === "mobile") {
      value = value.replace(/\D/g, "").slice(0, 10);
    }
    setForm({ ...form, [name]: value });
    setDirty(true);
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function validate() {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = "Full name is required";
    if (form.mobile.trim() && !/^[6-9][0-9]{9}$/.test(form.mobile.trim()))
      errors.mobile = "Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9";
    if (form.graduationYear) {
      const year = Number(form.graduationYear);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.graduationYear = "Enter a valid graduation year";
    }
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoadError(null);
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const data = await api.put("/students/me", toPayload(form));
      const initial = fromProfile(data);
      setForm(initial);
      setOriginal({ ...initial, updatedAt: data.updatedAt });
      setDirty(false);
      const stored = auth.getUser();
      if (stored) {
        auth.save({
          accessToken: auth.getAccessToken(),
          refreshToken: auth.getRefreshToken(),
          user: { ...stored, ...(data.fullName ? { fullName: data.fullName } : {}) },
        });
      }
      toast.success("Profile saved successfully.");
    } catch (err) {
      if (err.fieldErrors?.length) {
        const mapped = {};
        err.fieldErrors.forEach((fe) => (mapped[fe.field] = fe.message));
        setFieldErrors(mapped);
        toast.error(err.message || "Please fix the highlighted fields.");
      } else {
        toast.error(err.message || "Failed to save profile.");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (original) setForm(original);
    setFieldErrors({});
    setDirty(false);
    toast.message("Changes discarded");
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only JPG, PNG or WebP photos are accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be at most 2 MB.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setUploadingPhoto(true);
    try {
      const data = await api.post("/students/me/photo", formData);
      setPhotoKey(data.profilePhotoUrl || null);
      setPhotoVersion((v) => v + 1);
      window.dispatchEvent(new CustomEvent("careeros:photo-updated"));
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(err.message || "Could not upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handlePhotoRemove() {
    setRemovingPhoto(true);
    try {
      const data = await api.delete("/students/me/photo");
      setPhotoKey(data.profilePhotoUrl || null);
      setPhotoVersion((v) => v + 1);
      window.dispatchEvent(new CustomEvent("careeros:photo-updated"));
      toast.success("Profile photo removed.");
    } catch (err) {
      toast.error(err.message || "Could not remove photo.");
    } finally {
      setRemovingPhoto(false);
    }
  }

  const photoInitials = (form.fullName || auth.getUser()?.fullName || auth.getUser()?.email || "U")
    .split(/[\s@._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (loadingProfile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return <ErrorState title="Couldn't load your profile" description={loadError} onRetry={load} />;
  }

  const completion = computeCompletion(form);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Keep your personal, education and career details up to date — they power your career analysis."
        breadcrumb={<Breadcrumb items={[{ label: "Profile" }]} />}
        actions={<Badge variant="secondary">Student</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
              <Avatar className="size-28 border border-border/60">
                {photoUrl && (
                  <AvatarImage
                    src={photoUrl}
                    alt={form.fullName ? `${form.fullName}'s profile photo` : "Profile photo"}
                  />
                )}
                <AvatarFallback className="bg-primary/15 text-2xl font-bold text-primary">
                  {photoInitials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{form.fullName || "Your name"}</p>
                <p className="text-xs text-muted-foreground">
                  {photoKey ? "This photo shows across CareerOS." : "Add a photo — it shows across CareerOS."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={uploadingPhoto}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadingPhoto ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Camera className="size-3.5" aria-hidden="true" />
                  )}
                  {photoKey ? "Change photo" : "Upload photo"}
                </Button>
                {photoKey && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={removingPhoto || uploadingPhoto}
                    onClick={handlePhotoRemove}
                  >
                    {removingPhoto ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    )}
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">JPG, PNG or WebP · max 2 MB</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                aria-label="Upload profile photo"
                onChange={handlePhotoSelect}
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
              <CircularProgress value={completion} size={132} strokeWidth={11} tone={completion >= 80 ? "green" : "primary"} label="Profile completeness">
                <span className="text-3xl font-bold tracking-tight">{completion}%</span>
                <span className="text-xs font-medium text-muted-foreground">complete</span>
              </CircularProgress>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{form.fullName || "Your name"}</p>
                <p className="text-xs text-muted-foreground">
                  {completion === 100 ? "Looks great — ready for analysis." : "Fill in the checklist to complete it."}
                </p>
              </div>
            </CardContent>
          </Card>

          <details className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Completion checklist <span className="ml-1 font-normal text-muted-foreground">{completion}%</span>
            </summary>
            <div className="mt-3">
              <ul className="space-y-1.5">
                {checklist.map((item) => {
                  const done = String(form[item.key] || "").trim().length > 0;
                  return (
                    <li key={item.key} className="flex items-center gap-2 text-sm">
                      {done ? (
                        <CheckCircle2 className="size-4 shrink-0 text-chart-3" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                      )}
                      <span className={done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        </aside>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {dirty && (
            <Alert>
              <UserRound className="size-4" aria-hidden="true" />
              <AlertDescription>You have unsaved changes.</AlertDescription>
            </Alert>
          )}

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Personal information</CardTitle>
              <CardDescription>Your name and contact basics.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="fullName" label="Full name" required error={fieldErrors.fullName}>
                {(inputId) => (
                  <Input id={inputId} name="fullName" className="h-10 px-3" value={form.fullName} onChange={handleChange} aria-invalid={Boolean(fieldErrors.fullName)} />
                )}
              </Field>
              <Field id="mobile" label="Mobile" error={fieldErrors.mobile}>
                {(inputId) => (
                  <Input id={inputId} name="mobile" type="tel" inputMode="numeric" maxLength={10} placeholder="9876543210" className="h-10 px-3" value={form.mobile} onChange={handleChange} aria-invalid={Boolean(fieldErrors.mobile)} />
                )}
              </Field>
              <Field id="dateOfBirth" label="Date of birth">
                {(inputId) => (
                  <Input id={inputId} name="dateOfBirth" type="date" className="h-10 px-3" value={form.dateOfBirth} onChange={handleChange} />
                )}
              </Field>
              <Field id="location" label="Location">
                {(inputId) => (
                  <Input id={inputId} name="location" placeholder="City, State" className="h-10 px-3" value={form.location} onChange={handleChange} />
                )}
              </Field>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Education</CardTitle>
              <CardDescription>College, degree, branch and graduation details.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field id="college" label="College / University">
                  {(inputId) => (
                    <Input id={inputId} name="college" placeholder="Your college" className="h-10 px-3" value={form.college} onChange={handleChange} />
                  )}
                </Field>
              </div>
              <Select
                id="degree"
                label="Degree"
                options={degreeOptions}
                value={form.degree}
                onChange={(e) => handleChange({ target: { name: "degree", value: e.target.value } })}
                error={fieldErrors.degree}
              />
              <Field id="branch" label="Branch" error={fieldErrors.branch}>
                {(inputId) => (
                  <Input id={inputId} name="branch" placeholder="Computer Science" className="h-10 px-3" value={form.branch} onChange={handleChange} />
                )}
              </Field>
              <Field id="graduationYear" label="Graduation year" error={fieldErrors.graduationYear}>
                {(inputId) => (
                  <Input id={inputId} name="graduationYear" inputMode="numeric" placeholder="2027" className="h-10 px-3" value={form.graduationYear} onChange={handleChange} aria-invalid={Boolean(fieldErrors.graduationYear)} />
                )}
              </Field>
              <Select
                id="semester"
                label="Current semester"
                options={semesterOptions}
                value={form.semester}
                onChange={(e) => handleChange({ target: { name: "semester", value: e.target.value } })}
                error={fieldErrors.semester}
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Career links</CardTitle>
              <CardDescription>Where recruiters and our analysis can find you online.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field id="linkedinUrl" label="LinkedIn URL">
                {(inputId) => (
                  <Input id={inputId} name="linkedinUrl" placeholder="https://linkedin.com/in/…" className="h-10 px-3" value={form.linkedinUrl} onChange={handleChange} />
                )}
              </Field>
              <Field id="githubUrl" label="GitHub URL">
                {(inputId) => (
                  <Input id={inputId} name="githubUrl" placeholder="https://github.com/…" className="h-10 px-3" value={form.githubUrl} onChange={handleChange} />
                )}
              </Field>
              <Field id="portfolioUrl" label="Portfolio URL">
                {(inputId) => (
                  <Input id={inputId} name="portfolioUrl" placeholder="https://…" className="h-10 px-3" value={form.portfolioUrl} onChange={handleChange} />
                )}
              </Field>
            </CardContent>
          </Card>

          <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-xl border border-border/60 bg-card/90 p-3 shadow-card backdrop-blur">
            <Button type="button" variant="outline" size="lg" onClick={handleCancel} disabled={saving || !dirty}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={saving || !dirty}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </div>

      <Separator />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Last updated: {original?.updatedAt ? new Date(original.updatedAt).toLocaleString() : "—"}</span>
        <span className="inline-flex items-center gap-1.5">
          <Progress value={completion} tone={completion >= 80 ? "green" : "primary"} className="h-1.5 w-24" aria-label="Profile completeness" />
          {completion}%
        </span>
      </div>
    </div>
  );
}
