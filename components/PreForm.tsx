"use client";

import { useEffect, useState } from "react";
import { PRE_ITEMS } from "@/lib/items";
import { InspectionList } from "@/components/InspectionList";
import { PhotoEvidence } from "@/components/PhotoEvidence";
import { useInspectionForm } from "@/lib/useInspectionForm";
import HomeLink from "@/components/HomeLink";
import FormHeader from "@/components/FormHeader";
import ShareButtons from "@/components/ShareButtons";

export default function PreForm() {
  const form = useInspectionForm({
    prefix: "pre",
    defaultFields: {
      date: new Date().toISOString().slice(0, 10),
      startTime: "",
      driver: "",
      vehicleNo: "",
      trailerNo: "",
      odometer: "",
      inspector: "",
      vehicleType: "",
      existingDamage: "",
      driverCert: "",
      authorizerName: "",
      supervisorDecision: "",
    },
    validation: [
      { field: "date", label: "Date", rule: (v) => !!v.trim() },
      { field: "driver", label: "Driver / Trainee", rule: (v) => !!v.trim() },
      { field: "vehicleNo", label: "Vehicle / Unit No.", rule: (v) => !!v.trim() },
    ],
  });

  useEffect(() => {
    form.restore(PRE_ITEMS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { fields, setField, items, setItem, evidence, removeEvidence } = form;
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await form.submit();
    if (ok) {
      setDone(true);
    }
  }

  if (done) {
    return (
      <>
        <header className="top">
          <div className="header-row">
            <div className="brand">
              <h1>Evergreen Logistics</h1>
              <span>Pre-Trip Inspection</span>
            </div>
            <HomeLink />
          </div>
        </header>
        <main>
          <div className="card success-card">
            <div className="success-icon">✓</div>
            <h2>Pre-trip inspection submitted</h2>
            <p>
              Your report for <strong>{fields.vehicleNo || "this vehicle"}</strong> (driver:{" "}
              {fields.driver || "—"}) on {fields.date || "today"} has been saved to the DEGOONY
              database. The draft and outbox were cleared for this form.
            </p>
            <a className="btn btn-primary" href="/">
              Back to Home
            </a>
            <ShareButtons
              formType="Pre-Trip Inspection"
              fields={fields}
              items={items}
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
            <span>Pre-Trip Inspection</span>
          </div>
          <HomeLink />
        </div>
      </header>

      <main>
        <form onSubmit={onSubmit}>
          <div className="card tone-pre">
            <FormHeader icon="🚛" title="Vehicle & driver" subtitle="Complete before the vehicle is released" />
            <div className="row2">
              <div className="field">
                <label>Date</label>
                <input type="date" value={fields.date} onChange={(e) => setField("date", e.target.value)} />
              </div>
              <div className="field">
                <label>Start time</label>
                <input type="time" value={fields.startTime} onChange={(e) => setField("startTime", e.target.value)} />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Driver / Trainee *</label>
                <input type="text" value={fields.driver} onChange={(e) => setField("driver", e.target.value)} placeholder="Full name" />
              </div>
              <div className="field">
                <label>Vehicle / Unit No. *</label>
                <input type="text" value={fields.vehicleNo} onChange={(e) => setField("vehicleNo", e.target.value)} placeholder="e.g. DR-001" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Trailer / Equipment No. (if applicable)</label>
                <input type="text" value={fields.trailerNo} onChange={(e) => setField("trailerNo", e.target.value)} />
              </div>
              <div className="field">
                <label>Odometer reading</label>
                <input type="text" inputMode="numeric" value={fields.odometer} onChange={(e) => setField("odometer", e.target.value)} />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Inspector / Authorized person</label>
                <input type="text" value={fields.inspector} onChange={(e) => setField("inspector", e.target.value)} />
              </div>
              <div className="field">
                <label>Vehicle type</label>
                <input type="text" value={fields.vehicleType} onChange={(e) => setField("vehicleType", e.target.value)} placeholder="e.g. Electric Tricycle / Fuel Tricycle" />
              </div>
            </div>
          </div>

          <div className="card tone-pre">
            <FormHeader icon="✅" title="Pre-trip inspection" subtitle="Mark each item OK, Defect, or N/A" />
            <InspectionList
              items={PRE_ITEMS}
              showPhotos
              state={items}
              onChange={(id, patch) => setItem(id, patch)}
            />
          </div>

          <div className="card tone-pre">
            <FormHeader icon="📝" title="Existing damage / distinguishing marks" subtitle="Record damage that already existed before departure" />
            <div className="field">
              <textarea
                placeholder="Describe any dents, scratches or marks noted before departure"
                value={fields.existingDamage}
                onChange={(e) => setField("existingDamage", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Photo evidence</label>
              <p className="photo-notice">
                📷 Photos are <strong>uploaded to the DEGOONY database</strong> with your report,
                and kept on this device so you can also <strong>⤴ Share</strong> them via WhatsApp.
              </p>
              <PhotoEvidence
                suggested={["Front view", "Rear view", "Driver side", "Passenger side", "Odometer", "Damage close-up"]}
                photos={evidence}
                onChange={(list) => form.setEvidence(list)}
                onRemove={removeEvidence}
              />
            </div>
          </div>

          <div className="card tone-pre">
            <FormHeader icon="✍️" title="Driver certification" subtitle="I confirm I inspected this vehicle and truthfully recorded all defects, damage and abnormalities known at time of inspection" />
            <div className="field">
              <label>Driver signature (type full name)</label>
              <input type="text" value={fields.driverCert} onChange={(e) => setField("driverCert", e.target.value)} />
            </div>
          </div>

          <div className="card tone-pre">
            <FormHeader icon="🛂" title="Supervisor release decision" subtitle="Vehicle must be released by an authorized person" />
            <div className="field">
              <div className="radio-set">
                {["Fit for operation", "Restricted — see instructions", "Do not deploy / out of service"].map(
                  (opt) => (
                    <label key={opt} className={`radio-opt${fields.supervisorDecision === opt ? " checked" : ""}`}>
                      <input
                        type="radio"
                        name="pre_decision"
                        value={opt}
                        checked={fields.supervisorDecision === opt}
                        onChange={() => setField("supervisorDecision", opt)}
                      />
                      {opt}
                    </label>
                  ),
                )}
              </div>
            </div>
            <div className="field">
              <label>Supervisor / authorized person (signature)</label>
              <input type="text" value={fields.authorizerName} onChange={(e) => setField("authorizerName", e.target.value)} />
            </div>
          </div>

          {form.error && <div className="field-error">{form.error}</div>}

          <footer className="submit-bar single">
            <button className="btn btn-ghost" type="button" onClick={() => form.download()}>
              Backup
            </button>
            <button className="btn btn-primary" type="submit" disabled={form.busy}>
              {form.busy ? "Submitting…" : "Submit pre-trip"}
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
