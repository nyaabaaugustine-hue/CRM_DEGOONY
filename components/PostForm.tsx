"use client";

import { useEffect, useState } from "react";
import { POST_ITEMS } from "@/lib/items";
import { InspectionList } from "@/components/InspectionList";
import { PhotoEvidence } from "@/components/PhotoEvidence";
import { useInspectionForm } from "@/lib/useInspectionForm";
import HomeLink from "@/components/HomeLink";
import FormHeader from "@/components/FormHeader";
import ShareButtons from "@/components/ShareButtons";

export default function PostForm() {
  const form = useInspectionForm({
    prefix: "post",
    defaultFields: {
      date: new Date().toISOString().slice(0, 10),
      returnTime: "",
      driver: "",
      vehicleNo: "",
      endOdometer: "",
      batteryStatus: "",
      inspector: "",
      preState: "",
      variance: "",
      varianceDetails: "",
      incidentReportNo: "",
      driverCert: "",
      disposition: "",
      reviewedBy: "",
    },
    validation: [
      { field: "date", label: "Date", rule: (v) => !!v.trim() },
      { field: "driver", label: "Driver / Trainee", rule: (v) => !!v.trim() },
      { field: "vehicleNo", label: "Vehicle / Unit No.", rule: (v) => !!v.trim() },
      {
        field: "variance",
        label: "Mandatory variance question (accident/incident/change)",
        rule: (v) => !!v.trim(),
      },
    ],
  });

  useEffect(() => {
    form.restore(POST_ITEMS);
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
              <span>Post-Inspection</span>
            </div>
            <HomeLink />
          </div>
        </header>
        <main>
          <div className="card success-card">
            <div className="success-icon">✓</div>
            <h2>Post-inspection submitted</h2>
            <p>
              Your return report for <strong>{fields.vehicleNo || "this vehicle"}</strong> (driver:{" "}
              {fields.driver || "—"}) on {fields.date || "today"} has been saved to the DEGOONY
              database. The draft and outbox were cleared for this form.
            </p>
            <a className="btn btn-primary" href="/">
              Back to Home
            </a>
            <ShareButtons
              formType="Post-Trip Inspection"
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
            <span>Post-Trip Inspection</span>
          </div>
          <HomeLink />
        </div>
      </header>

      <main>
        <form onSubmit={onSubmit}>
          <div className="card tone-post">
            <FormHeader icon="🏁" title="Return details" subtitle="Record the vehicle condition on return" />
            <div className="row2">
              <div className="field">
                <label>Date</label>
                <input type="date" value={fields.date} onChange={(e) => setField("date", e.target.value)} />
              </div>
              <div className="field">
                <label>Return time</label>
                <input type="time" value={fields.returnTime} onChange={(e) => setField("returnTime", e.target.value)} />
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
                <label>End odometer reading</label>
                <input type="text" inputMode="numeric" value={fields.endOdometer} onChange={(e) => setField("endOdometer", e.target.value)} />
              </div>
              <div className="field">
                <label>Battery / charging status on return</label>
                <input type="text" value={fields.batteryStatus} onChange={(e) => setField("batteryStatus", e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Inspector / authorized person</label>
              <input type="text" value={fields.inspector} onChange={(e) => setField("inspector", e.target.value)} />
            </div>
            <div className="field">
              <label>Pre-trip condition reference (optional)</label>
              <textarea
                placeholder="Notes on the vehicle condition at departure, for comparison (e.g. existing dent on front-left panel)"
                value={fields.preState}
                onChange={(e) => setField("preState", e.target.value)}
              />
            </div>
<div className="field">
                <label>Return condition photos</label>
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

          <div className="card tone-post">
            <FormHeader icon="📋" title="Post-trip comparison" subtitle="Mark each item OK, Change / Defect, or N/A" />
            <InspectionList
              items={POST_ITEMS}
              okLabel="OK"
              defectLabel="Change / Defect"
              showPhotos
              state={items}
              onChange={(id, patch) => setItem(id, patch)}
            />
          </div>

          <div className="card tone-post">
            <FormHeader icon="⚠️" title="Mandatory variance question" subtitle="Did any accident, incident, near miss, damage, defect, missing component, or material change occur during this deployment?" />
            <div className="field">
              <div className="radio-set">
                {["No", "Yes"].map((opt) => (
                  <label key={opt} className={`radio-opt${fields.variance === opt ? " checked" : ""}`}>
                    <input
                      type="radio"
                      name="post_variance"
                      value={opt}
                      checked={fields.variance === opt}
                      onChange={() => setField("variance", opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>If yes — describe the condition / what happened</label>
              <textarea value={fields.varianceDetails} onChange={(e) => setField("varianceDetails", e.target.value)} />
            </div>
            <div className="field">
              <label>Incident / Defect Report No.</label>
              <input type="text" value={fields.incidentReportNo} onChange={(e) => setField("incidentReportNo", e.target.value)} />
            </div>
          </div>

          <div className="card tone-post">
            <FormHeader icon="✍️" title="Post-trip driver certification" subtitle="I confirm I truthfully reported any accident, incident, near miss, defect, damage, or material change during my responsibility for this vehicle" />
            <div className="field">
              <label>Driver signature (type full name)</label>
              <input type="text" value={fields.driverCert} onChange={(e) => setField("driverCert", e.target.value)} />
            </div>
          </div>

          <div className="card tone-post">
            <FormHeader icon="🔧" title="Supervisor / maintenance disposition" subtitle="After return, the supervisor decides what happens to the vehicle" />
            <div className="field">
              <div className="radio-set">
                {[
                  "Cleared for service",
                  "Cleared with observation",
                  "Maintenance inspection required",
                  "Do not deploy / out of service",
                ].map((opt) => (
                  <label key={opt} className={`radio-opt${fields.disposition === opt ? " checked" : ""}`}>
                    <input
                      type="radio"
                      name="post_disposition"
                      value={opt}
                      checked={fields.disposition === opt}
                      onChange={() => setField("disposition", opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Reviewed by (signature)</label>
              <input type="text" value={fields.reviewedBy} onChange={(e) => setField("reviewedBy", e.target.value)} />
            </div>
          </div>

          {form.error && <div className="field-error">{form.error}</div>}

          <footer className="submit-bar single">
            <button className="btn btn-ghost" type="button" onClick={() => form.download()}>
              Backup
            </button>
            <button className="btn btn-primary" type="submit" disabled={form.busy}>
              {form.busy ? "Submitting…" : "Submit post-trip"}
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
