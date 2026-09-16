"use client";

import { useEffect, useState } from "react";
import { PhotoEvidence } from "@/components/PhotoEvidence";
import { useInspectionForm } from "@/lib/useInspectionForm";
import HomeLink from "@/components/HomeLink";
import ShareButtons from "@/components/ShareButtons";
import FormHeader from "@/components/FormHeader";

const VEHICLE_TYPES = ["Electric Tricycle", "Fuel Tricycle"];

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function VehicleClientForm() {
  const [links, setLinks] = useState<string[]>([""]);
  const form = useInspectionForm({
    prefix: "vehicleClient",
    defaultFields: {
      clientName: "",
      phoneNumber: "",
      vehicleNumber: "",
      vehicleType: "",
      vehicleDescription: "",
      transactionDate: new Date().toISOString().slice(0, 10),
      transactionTime: nowTime(),
      amountReceived: "",
      receiptNotes: "",
      googleDriveLinks: "",
    },
    validation: [
      { field: "clientName", label: "Client Name", rule: (v) => !!v.trim() },
      { field: "phoneNumber", label: "Phone Number", rule: (v) => !!v.trim() },
      { field: "vehicleNumber", label: "Vehicle Number", rule: (v) => !!v.trim() },
      { field: "transactionDate", label: "Transaction Date", rule: (v) => !!v.trim() },
      { field: "transactionTime", label: "Transaction Time", rule: (v) => !!v.trim() },
      { field: "amountReceived", label: "Amount Received", rule: (v) => !!v.trim() },
      { field: "googleDriveLinks", label: "At least one Google Drive document link", rule: (v) => v.trim().split(/\n+/).filter(Boolean).length > 0 },
    ],
    subject: (f) => `VEHICLE CLIENT — ${f.clientName || ""} — ${f.vehicleNumber || ""} — ${f.transactionDate || ""}`,
    formType: "Vehicle Client Management",
  });

  useEffect(() => {
    form.restore([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { fields, setField, evidence, removeEvidence } = form;
  const [done, setDone] = useState(false);

  useEffect(() => {
    const joined = links.map((l) => l.trim()).filter(Boolean).join("\n");
    setField("googleDriveLinks", joined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links]);

  const setLink = (i: number, v: string) => {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? v : l)));
  };

  const addLink = () => setLinks((prev) => [...prev, ""]);

  const removeLink = (i: number) => {
    setLinks((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
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
              <span>Vehicle Client Management</span>
            </div>
            <HomeLink />
          </div>
        </header>
        <main>
          <div className="card success-card">
            <div className="success-icon">✓</div>
            <h2>Transaction recorded</h2>
            <p>
              The transaction for <strong>{fields.clientName || "this client"}</strong> (phone:{" "}
              {fields.phoneNumber || "—"}) on <strong>{fields.transactionDate || "—"}</strong> has been
              saved to the DEGOONY database with the receipt photo and document links.
            </p>
            <a className="btn btn-primary" href="/">
              Back to Home
            </a>
            <ShareButtons
              formType="Vehicle Client Transaction"
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
            <span>Vehicle Client Management</span>
          </div>
          <HomeLink />
        </div>
      </header>

      <main>
        <form onSubmit={onSubmit}>
          <div className="card tone-client">
            <FormHeader icon="👤" title="Client Details" subtitle="Who the transaction is with" />
            <div className="row2">
              <div className="field">
                <label>Client Name *</label>
                <input type="text" value={fields.clientName} onChange={(e) => setField("clientName", e.target.value)} placeholder="Full name of client" />
              </div>
              <div className="field">
                <label>Phone Number *</label>
                <input type="tel" inputMode="tel" value={fields.phoneNumber} onChange={(e) => setField("phoneNumber", e.target.value)} placeholder="e.g. 055 000 0000" />
              </div>
            </div>
          </div>

          <div className="card tone-client">
            <FormHeader icon="🛺" title="Vehicle Details" subtitle="The vehicle involved in the transaction" />
            <div className="row2">
              <div className="field">
                <label>Vehicle Number *</label>
                <input type="text" value={fields.vehicleNumber} onChange={(e) => setField("vehicleNumber", e.target.value)} placeholder="e.g. GW 1234-24" />
              </div>
              <div className="field">
                <label>Vehicle Type</label>
                <select value={fields.vehicleType} onChange={(e) => setField("vehicleType", e.target.value)}>
                  <option value="">Select…</option>
                  {VEHICLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Vehicle Description</label>
              <textarea value={fields.vehicleDescription} onChange={(e) => setField("vehicleDescription", e.target.value)} placeholder="Make, model, colour, or any identifying details" />
            </div>
          </div>

          <div className="card tone-client">
            <FormHeader icon="💰" title="Transaction" subtitle="Date, time and amount for this payment" />
            <div className="row2">
              <div className="field">
                <label>Transaction Date *</label>
                <input type="date" value={fields.transactionDate} onChange={(e) => setField("transactionDate", e.target.value)} />
              </div>
              <div className="field">
                <label>Transaction Time *</label>
                <input type="time" value={fields.transactionTime} onChange={(e) => setField("transactionTime", e.target.value)} />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Amount Received (GHS) *</label>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={fields.amountReceived} onChange={(e) => setField("amountReceived", e.target.value)} placeholder="e.g. 500.00" />
              </div>
              <div className="field">
                <label>Receipt Notes</label>
                <input type="text" value={fields.receiptNotes} onChange={(e) => setField("receiptNotes", e.target.value)} placeholder="e.g. Payment for vehicle service" />
              </div>
            </div>
          </div>

          <div className="card tone-client">
            <FormHeader icon="🧾" title="Receipt of Amount Received" subtitle="Photo of the physical receipt or payment proof" />
            <div className="field">
              <p className="photo-notice">
                📷 The receipt photo is <strong>uploaded to the DEGOONY database</strong> with the
                transaction and kept on this device so you can also <strong>⤴ Share</strong> it via WhatsApp.
              </p>
              <PhotoEvidence
                suggested={["Receipt", "Payment proof", "Mobile money", "Bank slip"]}
                photos={evidence}
                onChange={(list) => form.setEvidence(list)}
                onRemove={removeEvidence}
              />
            </div>
          </div>

          <div className="card tone-client">
            <FormHeader icon="☁️" title="Google Drive Documents" subtitle="Links to all transaction documents in Google Drive" />
            {links.map((link, i) => (
              <div className="row2" key={i}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Document Link {i + 1} *</label>
                  <input type="url" value={link} onChange={(e) => setLink(i, e.target.value)} placeholder="https://drive.google.com/…" />
                </div>
                <div className="field" style={{ flex: "0 0 auto", alignSelf: "flex-end" }}>
                  {links.length > 1 && (
                    <button className="btn btn-danger btn-small" type="button" onClick={() => removeLink(i)} style={{ minWidth: 84 }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button className="btn btn-ghost btn-small" type="button" onClick={addLink} style={{ minWidth: 160 }}>
              + Add another link
            </button>
          </div>

          {form.error && <div className="field-error">{form.error}</div>}

          <footer className="submit-bar single">
            <button className="btn btn-ghost" type="button" onClick={() => form.download()}>
              Backup
            </button>
            <button className="btn btn-primary" type="submit" disabled={form.busy}>
              {form.busy ? "Submitting…" : "Submit transaction"}
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