"use client";

import { useState } from "react";
import { getOutbox, removeOutbox } from "@/lib/store";
import type { QueuedSubmission } from "@/lib/store";
import { submitToBaserow, rehydrateEntryPhotos } from "@/lib/submit";
import { INSPECTION_TABLE_ID, DRIVER_TABLE_ID, VEHICLE_CLIENT_TABLE_ID } from "@/lib/config";

export default function Outbox() {
  const [entries, setEntries] = useState<QueuedSubmission[]>(() => getOutbox());
  const [state, setState] = useState<Record<string, "idle" | "busy" | "done" | "fail">>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (entries.length === 0) return null;

  const kindLabel = (prefix: string) =>
    prefix === "pre" ? "PRE" : prefix === "post" ? "POST" : prefix === "vehicleClient" ? "CLIENT" : "DRIVER";

  const resubmit = async (entry: QueuedSubmission) => {
    setState((s) => ({ ...s, [entry.id]: "busy" }));
    const tableId =
      entry.tableId ??
      (entry.prefix === "driver" ? DRIVER_TABLE_ID : entry.prefix === "vehicleClient" ? VEHICLE_CLIENT_TABLE_ID : INSPECTION_TABLE_ID);
    const { items, resolvedEvidence, resolvedPrimaryPhoto } = await rehydrateEntryPhotos(entry.items, entry.evidence, entry.primaryPhoto);
    const result = await submitToBaserow(
      tableId,
      entry.fields,
      items,
      entry.prefix,
      resolvedEvidence,
      entry.subject,
      resolvedPrimaryPhoto,
    );
    if (result.ok) {
      setEntries(removeOutbox(entry.id));
      setState((s) => ({ ...s, [entry.id]: "done" }));
      setStatusMsg("Submission sent.");
    } else {
      setState((s) => ({ ...s, [entry.id]: "fail" }));
      setStatusMsg(`Still failing: ${result.message}. Try again when online.`);
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const remove = (id: string) => {
    setEntries(removeOutbox(id));
  };

  const downloadTextBackup = (entry: QueuedSubmission) => {
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entry.prefix}_${entry.fields.vehicleNo || entry.fields.fullName || entry.fields.clientName || "submission"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card outbox">
      <h2>
        Pending submissions<small>Saved locally — retry stores the text and photos in the DEGOONY database.</small>
      </h2>
      {statusMsg && <div className="outbox-msg">{statusMsg}</div>}
      {entries.map((e) => (
        <div className="outbox-item" key={e.id}>
          <div className="outbox-meta">
            <span className={`pill-mini ${e.prefix === "pre" ? "pre" : e.prefix === "post" ? "post" : e.prefix === "vehicleClient" ? "client" : "driver"}`}>
              {kindLabel(e.prefix)}
            </span>
            <b>{e.fields.vehicleNo || e.fields.fullName || e.fields.clientName || "—"}</b>
            <span>{e.fields.driver || e.fields.phoneNumber || ""}</span>
            <small>{new Date(e.queuedAt).toLocaleString()}</small>
          </div>
          <div className="outbox-actions">
            <button className="btn btn-small" disabled={state[e.id] === "busy"} onClick={() => resubmit(e)}>
              {state[e.id] === "busy" ? "Sending…" : "Retry"}
            </button>
            <button className="btn btn-small" onClick={() => downloadTextBackup(e)}>
              Backup
            </button>
            <button className="btn btn-small btn-danger" onClick={() => remove(e.id)}>
              Discard
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}