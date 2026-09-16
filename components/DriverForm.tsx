"use client";

import { useEffect, useState } from "react";
import { PhotoEvidence } from "@/components/PhotoEvidence";
import { useInspectionForm } from "@/lib/useInspectionForm";
import HomeLink from "@/components/HomeLink";
import ShareButtons from "@/components/ShareButtons";
import FormHeader from "@/components/FormHeader";
import { addValidatedPhoto, removeSavedPhoto } from "@/lib/images";
import type { LocalPhoto } from "@/lib/images";

const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];

export default function DriverForm() {
  const form = useInspectionForm({
    prefix: "driver",
    defaultFields: {
      date: new Date().toISOString().slice(0, 10),
      fullName: "",
      dob: "",
      ghanaCardNo: "",
      residentialAddress: "",
      phoneNumber: "",
      emergencyContact: "",
      maritalStatus: "",
      licenseNumber: "",
      licenseClass: "",
      validLicense: "",
      yearsExperience: "",
      previousEmployer: "",
      gpsDirections: "",
      salesTargets: "",
      g1Name: "",
      g1Relationship: "",
      g1Phone: "",
      g1Occupation: "",
      g2Name: "",
      g2Relationship: "",
      g2Phone: "",
      g2Occupation: "",
    },
    validation: [
      { field: "fullName", label: "Full Name", rule: (v) => !!v.trim() },
      { field: "phoneNumber", label: "Phone Number", rule: (v) => !!v.trim() },
      { field: "g1Name", label: "Guarantor #1 (Family Member)", rule: (v) => !!v.trim() },
      { field: "g1Phone", label: "Guarantor #1 Phone", rule: (v) => !!v.trim() },
    ],
    subject: (f) => `DRIVER REGISTRATION — ${f.fullName || ""} — ${f.phoneNumber || ""}`,
    formType: "Driver Job Application & Interview Questionnaire",
  });

  useEffect(() => {
    form.restore([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { fields, setField, evidence, removeEvidence, primaryPhoto, setPrimaryPhoto } = form;
  const [done, setDone] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const showPhotoError = (msg: string) => {
    setPhotoError(msg);
    window.setTimeout(() => setPhotoError(null), 4000);
  };

  const onPickPhoto = async (file: File) => {
    const res = await addValidatedPhoto(file, 0);
    if (!res.ok) {
      if (res.error === "too-large") showPhotoError("Photo is too large — choose a smaller image.");
      else showPhotoError("Could not read that image.");
      return;
    }
    if (res.photo) setPrimaryPhoto(res.photo);
  };

  const removePhoto = async () => {
    if (primaryPhoto) await removeSavedPhoto(primaryPhoto);
    setPrimaryPhoto(null);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await form.submit();
    if (ok) setDone(true);
  }

  if (done) {
    return (
      <>
        <header className="top">
          <div className="header-row">
            <div className="brand">
              <h1>Evergreen Logistics</h1>
              <span>Driver Registration</span>
            </div>
            <HomeLink />
          </div>
        </header>
        <main>
          <div className="card success-card">
            <div className="success-icon">✓</div>
            <h2>Driver application submitted</h2>
            <p>
              The registration for <strong>{fields.fullName || "this applicant"}</strong> (phone:{" "}
              {fields.phoneNumber || "—"}) has been saved to the DEGOONY database. The draft
              and outbox were cleared for this form.
            </p>
            <a className="btn btn-primary" href="/">
              Back to Home
            </a>
            <ShareButtons
              formType="Driver Registration"
              fields={fields}
              items={{}}
              evidence={evidence}
            />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="top">
        <div className="header-row">
          <div className="brand">
            <h1>Evergreen Logistics</h1>
            <span>Driver Job Application</span>
          </div>
          <HomeLink />
        </div>
      </header>

      <main>
        <form onSubmit={onSubmit}>
          <div className="card tone-driver">
            <FormHeader icon="📷" title="Driver photo" subtitle="Portrait of the applicant — front-facing picture" />
            {primaryPhoto ? (
              <div className="driver-photo-set">
                <div className="driver-preview-wrap">
                  <img src={primaryPhoto.url} alt="Driver portrait" className="driver-preview" />
                  <button type="button" className="thumb-remove" onClick={removePhoto} title="Remove photo">
                    ×
                  </button>
                </div>
                <div className="driver-photo-actions">
                  <label className="btn btn-ghost btn-small driver-photo-btn">
                    Replace photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPickPhoto(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p className="scene-note">Saved with the application in the DEGOONY database.</p>
                </div>
              </div>
            ) : (
              <>
                <label className="driver-photo-empty">
                  <span className="driver-photo-icon">📷</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onPickPhoto(f);
                      e.target.value = "";
                    }}
                  />
                  <span className="driver-photo-label">Add driver photo</span>
                  <span className="driver-photo-sub">Tap to capture or choose a portrait</span>
                </label>
                <p className="photo-notice">
                  📷 The photo is <strong>uploaded to the DEGOONY database</strong> with the application and
                  kept on this device for sharing via WhatsApp.
                </p>
              </>
            )}
            {photoError && <div className="photo-error">{photoError}</div>}
          </div>

          <div className="card tone-driver">
            <FormHeader icon="👤" title="Driver Application Form" subtitle="Applicant details — fill before interview" />
            <div className="row2">
              <div className="field">
                <label>Full Name *</label>
                <input type="text" value={fields.fullName} onChange={(e) => setField("fullName", e.target.value)} placeholder="Full name" />
              </div>
              <div className="field">
                <label>Date of Birth</label>
                <input type="date" value={fields.dob} onChange={(e) => setField("dob", e.target.value)} />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Ghana Card Number</label>
                <input type="text" value={fields.ghanaCardNo} onChange={(e) => setField("ghanaCardNo", e.target.value)} placeholder="e.g. GHA-123456789-0" />
              </div>
              <div className="field">
                <label>Residential Address</label>
                <input type="text" value={fields.residentialAddress} onChange={(e) => setField("residentialAddress", e.target.value)} placeholder="Town / district / landmark" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Phone Number *</label>
                <input type="tel" inputMode="tel" value={fields.phoneNumber} onChange={(e) => setField("phoneNumber", e.target.value)} placeholder="e.g. 055 000 0000" />
              </div>
              <div className="field">
                <label>Emergency Contact</label>
                <input type="tel" inputMode="tel" value={fields.emergencyContact} onChange={(e) => setField("emergencyContact", e.target.value)} placeholder="Phone of next of kin" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Marital Status</label>
                <select value={fields.maritalStatus} onChange={(e) => setField("maritalStatus", e.target.value)}>
                  <option value="">Select…</option>
                  {MARITAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Driver's License Number</label>
                <input type="text" value={fields.licenseNumber} onChange={(e) => setField("licenseNumber", e.target.value)} placeholder="License no." />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>License Class</label>
                <select value={fields.licenseClass} onChange={(e) => setField("licenseClass", e.target.value)}>
                  <option value="">Select…</option>
                  {["A", "B", "D", "E", "Other"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Valid Driver's License?</label>
                <div className="radio-set">
                  {["Yes", "No"].map((opt) => (
                    <label key={opt} className={`radio-opt${fields.validLicense === opt ? " checked" : ""}`}>
                      <input
                        type="radio"
                        name="driver_valid_license"
                        value={opt}
                        checked={fields.validLicense === opt}
                        onChange={() => setField("validLicense", opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Years of Driving Experience</label>
                <input type="number" inputMode="numeric" min="0" value={fields.yearsExperience} onChange={(e) => setField("yearsExperience", e.target.value)} placeholder="e.g. 5" />
              </div>
              <div className="field">
                <label>Previous Employer</label>
                <input type="text" value={fields.previousEmployer} onChange={(e) => setField("previousEmployer", e.target.value)} placeholder="Company / self-employed" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Can Applicant Read GPS Directions?</label>
                <div className="radio-set">
                  {["Yes", "No"].map((opt) => (
                    <label key={opt} className={`radio-opt${fields.gpsDirections === opt ? " checked" : ""}`}>
                      <input
                        type="radio"
                        name="driver_gps"
                        value={opt}
                        checked={fields.gpsDirections === opt}
                        onChange={() => setField("gpsDirections", opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Comfortable with Daily Sales Targets?</label>
                <div className="radio-set">
                  {["Yes", "No"].map((opt) => (
                    <label key={opt} className={`radio-opt${fields.salesTargets === opt ? " checked" : ""}`}>
                      <input
                        type="radio"
                        name="driver_sales"
                        value={opt}
                        checked={fields.salesTargets === opt}
                        onChange={() => setField("salesTargets", opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card tone-driver">
            <FormHeader icon="📄" title="Photo evidence" subtitle="Licence, Ghana Card or ID photo" />
            <div className="field">
              <p className="photo-notice">
                📷 Photos are <strong>uploaded to the DEGOONY database</strong> with your application,
                and kept on this device so you can also <strong>⤴ Share</strong> them via WhatsApp.
              </p>
              <PhotoEvidence
                suggested={["Driver's licence", "Ghana Card", "Passport photo", "Applicant portrait"]}
                photos={evidence}
                onChange={(list) => form.setEvidence(list)}
                onRemove={removeEvidence}
              />
            </div>
          </div>

          <div className="card tone-driver">
            <FormHeader icon="🤝" title="Guarantor Information" subtitle="Two guarantors are required" />
            <h3 className="guarantor-head">Guarantor #1 (Family Member) *</h3>
            <div className="row2">
              <div className="field">
                <label>Name</label>
                <input type="text" value={fields.g1Name} onChange={(e) => setField("g1Name", e.target.value)} placeholder="Full name" />
              </div>
              <div className="field">
                <label>Relationship to Applicant</label>
                <input type="text" value={fields.g1Relationship} onChange={(e) => setField("g1Relationship", e.target.value)} placeholder="e.g. Father, Sister" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Phone Number *</label>
                <input type="tel" inputMode="tel" value={fields.g1Phone} onChange={(e) => setField("g1Phone", e.target.value)} placeholder="e.g. 055 000 0000" />
              </div>
              <div className="field">
                <label>Occupation</label>
                <input type="text" value={fields.g1Occupation} onChange={(e) => setField("g1Occupation", e.target.value)} placeholder="e.g. Teacher" />
              </div>
            </div>

            <h3 className="guarantor-head">Guarantor #2 (Pastor / Imam / Lawyer / Doctor / Community Leader)</h3>
            <div className="row2">
              <div className="field">
                <label>Name</label>
                <input type="text" value={fields.g2Name} onChange={(e) => setField("g2Name", e.target.value)} placeholder="Full name" />
              </div>
              <div className="field">
                <label>Relationship to Applicant</label>
                <input type="text" value={fields.g2Relationship} onChange={(e) => setField("g2Relationship", e.target.value)} placeholder="e.g. Pastor, Community leader" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Phone Number</label>
                <input type="tel" inputMode="tel" value={fields.g2Phone} onChange={(e) => setField("g2Phone", e.target.value)} placeholder="e.g. 055 000 0000" />
              </div>
              <div className="field">
                <label>Occupation / Position</label>
                <input type="text" value={fields.g2Occupation} onChange={(e) => setField("g2Occupation", e.target.value)} placeholder="e.g. Imam at …" />
              </div>
            </div>
          </div>

          {form.error && <div className="field-error">{form.error}</div>}

          <footer className="submit-bar single">
            <button className="btn btn-ghost" type="button" onClick={() => form.download()}>
              Backup
            </button>
            <button className="btn btn-primary" type="submit" disabled={form.busy}>
              {form.busy ? "Submitting…" : "Submit registration"}
            </button>
          </footer>
        </form>
      </main>

      {form.error && !form.justQueued && (
        <div className="toast show error">{form.error}</div>
      )}
      {form.justQueued && <div className="toast show error">Saved offline — go back to retry from Home.</div>}
    </>
  );
}