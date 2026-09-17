"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import HomeLink from "@/components/HomeLink";
import { INSPECTION_TABLE_ID, DRIVER_TABLE_ID, VEHICLE_CLIENT_TABLE_ID } from "@/lib/config";
import { cacheRows, loadCachedAll } from "@/lib/recordCache";
import { analyzeInspections, anomalyLabel } from "@/lib/comparison";
import type { Analysis, CompareRow, InspectionRow, Verdict } from "@/lib/comparison";

type Rec = Record<string, unknown>;
type Tab = "inspection" | "driver" | "client";

function asText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const parts = v
      .map(asText)
      .filter((x): x is string => !!x)
      .join(", ");
    return parts || null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("value" in o) return asText(o.value);
    if ("text" in o) return asText(o.text);
    if ("url" in o) return asText(o.url);
  }
  return null;
}

function photosOf(v: unknown): { url: string; name?: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (x): x is Record<string, unknown> => !!x && typeof x === "object" && typeof (x as Record<string, unknown>).url === "string",
    )
    .map((x) => ({
      url: String(x.url),
      name: typeof x.name === "string" ? x.name : undefined,
    }));
}

function humanLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Split a field value into tokens and render URL tokens (e.g. Google Drive
// document links) as clickable links that open the file in a new tab.
function renderLinkedValue(value: string | null, key: string): React.ReactNode {
  if (!value) return null;
  return value.split(/\s+/).filter(Boolean).map((tok, i) =>
    /^https?:\/\//i.test(tok) ? (
      <a
        key={i}
        className="record-link"
        href={tok}
        target="_blank"
        rel="noreferrer"
        title="Open document in Google Drive"
      >
        {key === "google_drive_links" ? tok.replace(/^https?:\/\/(www\.)?/, "") : tok}
        <span className="record-link-arrow">↗</span>
      </a>
    ) : (
      <span key={i}>{i > 0 ? " " : ""}{tok}</span>
    ),
  );
}

const API = (tableId: number) => `/api/rows?table=${tableId}`;

async function fetchRows(tableId: number): Promise<Rec[]> {
  const res = await fetch(API(tableId));
  if (!res.ok) throw new Error(`Server ${res.status}`);
  const js = (await res.json()) as { results?: Rec[]; error?: string };
  if (js.error) throw new Error(js.error);
  return (js.results || []).sort((a, b) => {
    const na = typeof a.id === "number" ? a.id : Number.NEGATIVE_INFINITY;
    const nb = typeof b.id === "number" ? b.id : Number.NEGATIVE_INFINITY;
    return nb - na;
  });
}

type FieldDef = {
  key: keyof Record<string, unknown>;
  type: "text" | "textarea" | "date" | "select";
  options?: string[];
};

const INSP_FIELDS: FieldDef[] = [
  { key: "driver_name", type: "text" },
  { key: "form_type", type: "select", options: ["Pre-Trip Inspection", "Post-Trip Inspection"] },
  { key: "date", type: "date" },
  { key: "start_time", type: "text" },
  { key: "vehicle_no", type: "text" },
  { key: "trailer_no", type: "text" },
  { key: "odometer", type: "text" },
  { key: "inspector", type: "text" },
  { key: "vehicle_type", type: "text" },
  { key: "existing_damage", type: "textarea" },
  { key: "items_report", type: "textarea" },
  { key: "evidence_captions", type: "textarea" },
  { key: "driver_cert", type: "text" },
  {
    key: "supervisor_decision",
    type: "select",
    options: ["Fit for operation", "Restricted — see instructions", "Do not deploy / out of service"],
  },
  { key: "authorizer_name", type: "text" },
  { key: "email_subject", type: "text" },
];

const DRV_FIELDS: FieldDef[] = [
  { key: "full_name", type: "text" },
  { key: "date_of_birth", type: "date" },
  { key: "ghana_card_no", type: "text" },
  { key: "residential_address", type: "text" },
  { key: "phone_number", type: "text" },
  { key: "emergency_contact", type: "text" },
  { key: "marital_status", type: "select", options: ["Single", "Married", "Divorced", "Widowed"] },
  { key: "drivers_license_no", type: "text" },
  { key: "license_class", type: "select", options: ["A", "B", "D", "E", "Other"] },
  { key: "valid_license", type: "select", options: ["Yes", "No"] },
  { key: "years_experience", type: "text" },
  { key: "previous_employer", type: "text" },
  { key: "gps_directions", type: "select", options: ["Yes", "No"] },
  { key: "sales_targets", type: "select", options: ["Yes", "No"] },
  { key: "guarantor_1_name", type: "text" },
  { key: "guarantor_1_relationship", type: "text" },
  { key: "guarantor_1_phone", type: "text" },
  { key: "guarantor_1_occupation", type: "text" },
  { key: "guarantor_2_name", type: "text" },
  { key: "guarantor_2_relationship", type: "text" },
  { key: "guarantor_2_phone", type: "text" },
  { key: "guarantor_2_occupation", type: "text" },
];

const CLIENT_FIELDS: FieldDef[] = [
  { key: "client_name", type: "text" },
  { key: "phone_number", type: "text" },
  { key: "vehicle_number", type: "text" },
  { key: "vehicle_type", type: "select", options: ["Electric Tricycle", "Fuel Tricycle"] },
  { key: "vehicle_description", type: "textarea" },
  { key: "transaction_date", type: "date" },
  { key: "transaction_time", type: "text" },
  { key: "amount_received", type: "text" },
  { key: "receipt_notes", type: "textarea" },
  { key: "google_drive_links", type: "textarea" },
];

const FIELDS_FOR: Record<Tab, FieldDef[]> = { inspection: INSP_FIELDS, driver: DRV_FIELDS, client: CLIENT_FIELDS };

const TAB_META: Record<Tab, { label: string; singular: string; link: string }> = {
  inspection: { label: "Inspections", singular: "inspection", link: "/pre" },
  driver: { label: "Drivers", singular: "driver", link: "/driver" },
  client: { label: "Clients", singular: "client", link: "/vehicle-client" },
};

function statusChipClass(status: string): string {
  if (status === "OK") return "ok";
  if (status === "DEFECT") return "defect";
  if (status === "N/A") return "na";
  return "unrec";
}

function verdictClass(v: Verdict): string {
  if (v === "NEW_DEFECT" || v === "PERSISTENT") return "bad";
  if (v === "RESOLVED") return "good";
  return "mild";
}

function renderCompareRows(cmp: CompareRow[]) {
  const relevant = cmp.filter((c) => c.verdict !== "CLEAR" && c.verdict !== "N_A");
  if (relevant.length === 0) {
    return (
      <div className="cmp-clear">✓ Every recorded item matched between pre and post — no anomalies.</div>
    );
  }
  return (
    <div className="cmp-list">
      {relevant.map((c, i) => {
        const isAnomaly = c.verdict === "NEW_DEFECT" || c.verdict === "PERSISTENT";
        const isResolved = c.verdict === "RESOLVED";
        return (
          <div key={i} className={`cmp-row${isAnomaly ? " anomaly" : isResolved ? " resolved" : ""}`}>
            <span className="cmp-sys">{c.system}</span>
            <div className="cmp-cards">
              <div className={`cmp-card pre ${statusChipClass(c.preStatus)}`}>
                <span className="cmp-card-label">Pre</span>
                <span className="cmp-card-val">{c.preStatus}</span>
              </div>
              <span className="cmp-arrow">→</span>
              <div className={`cmp-card post ${statusChipClass(c.postStatus)}${isAnomaly ? " flash" : ""}`}>
                <span className="cmp-card-label">Post</span>
                <span className="cmp-card-val">{c.postStatus}</span>
              </div>
            </div>
            <span className={`cmp-verdict ${verdictClass(c.verdict)}`}>
              {anomalyLabel(c.verdict) || "Not recorded"}
            </span>
            {c.notes.length > 0 && (
              <span className="cmp-note">
                <b>Note:</b> {c.notes.join(" · ")}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RecordsPage() {
  const [tab, setTab] = useState<Tab>("inspection");
  const [data, setData] = useState<{ inspection: Rec[]; driver: Rec[]; client: Rec[] }>({
    inspection: [],
    driver: [],
    client: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState<{ savedAt: number } | null>(null);
  const [editing, setEditing] = useState<{ tab: Tab; id: number } | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<number | null>(null);
  const [driverPhotoMap, setDriverPhotoMap] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [inspFilter, setInspFilter] = useState<"all" | "open" | "compared" | "anomaly">("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ tableId: number; rowId: number; existing: { url: string; name?: string }[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inspection, driver, client] = await Promise.all([
        fetchRows(INSPECTION_TABLE_ID),
        fetchRows(DRIVER_TABLE_ID),
        fetchRows(VEHICLE_CLIENT_TABLE_ID),
      ]);
      setData({ inspection, driver, client });
      setOffline(null);
      await Promise.all([
        cacheRows("inspection", inspection),
        cacheRows("driver", driver),
        cacheRows("client", client),
      ]);
    } catch (e) {
      // Live fetch failed — fall back to the copy of the Baserow data saved
      // inside the app (IndexedDB). Never fabricate records.
      const cached = await loadCachedAll();
      if (cached && (cached.inspection.length || cached.driver.length || cached.client.length)) {
        setData({ inspection: cached.inspection, driver: cached.driver, client: cached.client });
        setOffline({ savedAt: cached.savedAt });
        setError(null);
      } else {
        setError("Could not load records — check connection or Baserow access.");
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Build a name→photo map from driver records so inspection cards can show
  // the driver's portrait even though inspection rows don't store it.
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const drv of data.driver) {
      const name = asText(drv.full_name);
      const photos = photosOf(drv.photos);
      if (name && photos.length > 0) {
        map[name.toLowerCase().trim()] = photos[0].url;
      }
    }
    setDriverPhotoMap(map);
  }, [data.driver]);

  const onProfilePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    setPhotoBusy(uploadTarget.rowId);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!upRes.ok) throw new Error("Upload failed");
      const fileRef = (await upRes.json()) as { url: string; name?: string };
      const photos = [...uploadTarget.existing, { url: fileRef.url, name: fileRef.name || file.name }];
      const patchRes = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: uploadTarget.tableId, rowId: uploadTarget.rowId, row: { photos } }),
      });
      const js = (await patchRes.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!patchRes.ok || !js?.ok) throw new Error(js?.message || "Save failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save photo.");
      setTimeout(() => setError(null), 4000);
    } finally {
      setPhotoBusy(null);
      setUploadTarget(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openEdit = (row: Rec) => {
    const id = typeof row.id === "number" ? row.id : Number(row.id);
    if (!Number.isFinite(id)) return;
    const fields = FIELDS_FOR[tab];
    const values: Record<string, string> = {};
    for (const f of fields) values[f.key as string] = asText(row[f.key]) ?? "";
    setEditValues(values);
    setEditError(null);
    setEditing({ tab, id });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditBusy(true);
    setEditError(null);
    const row: Record<string, unknown> = {};
    for (const f of FIELDS_FOR[editing.tab]) {
      const raw = (editValues[f.key as string] ?? "").trim();
      if (f.type === "select") {
        // Baserow rejects unknown/empty values for single-select fields —
        // send only a valid option, otherwise omit the field entirely.
        if (raw !== "" && (f.options || []).includes(raw)) row[f.key as string] = raw;
      } else if (raw === "") {
        // "Put dash to all empty place" — only for free text; empty date
        // fields are omitted (Baserow rejects empty date strings).
        if (f.type !== "date") row[f.key as string] = "-";
      } else {
        row[f.key as string] = raw;
      }
    }
    // Offline edits persist to the in-app cache and sync later.
    if (offline) {
      const key = editing.tab as "inspection" | "driver" | "client";
      const updated = (data[key] as Rec[]).map((r) => (r.id === editing.id ? { ...r, ...row } : r));
      setData((prev) => ({ ...prev, [key]: updated }));
      await cacheRows(key, updated);
      closeEdit();
      setEditBusy(false);
      return;
    }
    try {
      const tableId =
        editing.tab === "inspection"
          ? INSPECTION_TABLE_ID
          : editing.tab === "driver"
            ? DRIVER_TABLE_ID
            : VEHICLE_CLIENT_TABLE_ID;
      const res = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, rowId: editing.id, row }),
      });
      const js = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !js?.ok) {
        setEditError(js?.message || `Server ${res.status}`);
        return;
      }
      const id = editing.id;
      closeEdit();
      await load();
      console.log(`record ${id} updated`);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setEditBusy(false);
    }
  };

  const realRows = data[tab];
  const meta = TAB_META[tab];
  const rows = realRows;
  const analysis: Analysis = useMemo(() => analyzeInspections(data.inspection as InspectionRow[]), [data.inspection]);
  const q = query.trim().toLowerCase();
  const visibleRows = q
    ? rows.filter((r) =>
        Object.entries(r)
          .filter(([k]) => k !== "photos")
          .map(([, v]) => asText(v) || "")
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : tab === "inspection"
      ? rows.filter((r) => {
          const id = Number(r.id);
          const st = analysis.statusByRow[id];
          if (inspFilter === "open") return st?.kind === "open";
          if (inspFilter === "compared") return st?.kind === "compared";
          if (inspFilter === "anomaly") return st?.kind === "compared" && st.anomalies > 0;
          return true;
        })
      : rows;

  return (
    <>
      <header className="top">
        <div className="header-row">
          <div className="brand">
            <h1>Evergreen Logistics</h1>
            <span>{meta.label} saved</span>
          </div>
          <HomeLink />
        </div>
      </header>
      <main>
        <div className="card">
          <div className="records-head">
            <div className="records-title">
              <h2>Submission records</h2>
              <span className="records-sub">
                {q
                  ? `${visibleRows.length} of ${rows.length} ${meta.singular} records match “${query.trim()}”`
                  : `${rows.length} ${meta.singular} record${rows.length === 1 ? "" : "s"}${offline ? ` · offline copy saved ${new Date(offline.savedAt).toLocaleString()}` : " · DEGOONY database"}`}
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-small refresh-btn" onClick={load} disabled={loading}>
              ⟳ {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <div className="records-toolbar">
            <label className="search-box">
              <span className="search-ico">⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${meta.singular} records…`}
                enterKeyHint="search"
              />
              {query && (
                <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
                  ×
                </button>
              )}
            </label>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={`tab${tab === "inspection" ? " active" : ""}`}
              onClick={() => setTab("inspection")}
            >
              Inspections
              <span className="tab-count">{data.inspection.length}</span>
            </button>
            <button
              type="button"
              className={`tab${tab === "driver" ? " active" : ""}`}
              onClick={() => setTab("driver")}
            >
              Drivers
              <span className="tab-count">{data.driver.length}</span>
            </button>
            <button
              type="button"
              className={`tab${tab === "client" ? " active" : ""}`}
              onClick={() => setTab("client")}
            >
              Clients
              <span className="tab-count">{data.client.length}</span>
            </button>
          </div>

          {tab === "inspection" && rows.length > 0 && (
            <div className="insp-summary">
              <span className={`schip${analysis.summary.open > 0 ? " amber" : ""}`}>
                Open · awaiting post-deploy inspection <b>{analysis.summary.open}</b>
              </span>
              <span className="schip green">
                Compared <b>{analysis.summary.compared}</b>
              </span>
              <span className={`schip${analysis.summary.anomalies > 0 ? " red" : " green"}`}>
                Anomalies detected <b>{analysis.summary.anomalies}</b>
              </span>
            </div>
          )}

          {tab === "inspection" && rows.length > 0 && (
            <div className="filter-chips">
              {(
                [
                  ["all", "All"],
                  ["open", "Open"],
                  ["compared", "Compared"],
                  ["anomaly", "Anomalies"],
                ] as const
              ).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={`fchip${inspFilter === key ? " active" : ""}`}
                  onClick={() => setInspFilter(key)}
                >
                  {label}
                  {key === "all" && <span className="fchip-count">{rows.length}</span>}
                  {key === "open" && <span className="fchip-count">{analysis.summary.open}</span>}
                  {key === "compared" && <span className="fchip-count">{analysis.summary.compared}</span>}
                  {key === "anomaly" && <span className="fchip-count">{analysis.summary.anomalies}</span>}
                </button>
              ))}
            </div>
          )}

          {error && <div className="photo-error">{error}</div>}
          {offline && !error && (
            <div className="photo-notice demo-notice">
              Offline — showing the copy of your records saved in this app{" "}
              <strong>{new Date(offline.savedAt).toLocaleString()}</strong>. Changes you make now are saved on
              this device and will sync to the DEGOONY database when the connection returns.
            </div>
          )}
          {!error && rows.length === 0 && (
            <div className="empty-state">
              <span className="empty-orb" />
              <p>
                <strong>No {meta.singular} submissions yet.</strong>
              </p>
              <p>Submitting the {meta.singular} form will show it here for review.</p>
              <Link href={meta.link}>
                <button type="button" className="btn btn-primary btn-small">
                  Open {meta.singular} form
                </button>
              </Link>
            </div>
          )}
          {!loading && q && visibleRows.length === 0 && rows.length > 0 && (
            <div className="empty-state">
              <span className="empty-orb" />
              <p>
                <strong>No results for “{query.trim()}”.</strong>
              </p>
              <p>Try a different name, ID or keyword.</p>
            </div>
          )}

          {loading && rows.length === 0 ? (
            <>
              <div className="skel" />
              <div className="skel" />
              <div className="skel" />
            </>
          ) : visibleRows.map((row) => {
            const photos = photosOf(row.photos);
            const recordProfile = photos.length > 0 ? photos[0] : null;
            const driverName = asText(row.driver_name) || asText(row.full_name) || "";
            const lookupKey = driverName.toLowerCase().trim();
            const fallbackPhoto = !recordProfile && driverPhotoMap[lookupKey] ? driverPhotoMap[lookupKey] : null;
            const profileUrl = recordProfile?.url || fallbackPhoto || (tab === "client" && photos.length > 0 ? photos[0].url : null);
            const entries = Object.entries(row).filter(
              ([k, v]) => !["id", "created_on", "updated_on", "photos"].includes(k) && asText(v) !== null,
            );
            const title =
              asText(row.driver_name) ||
              asText(row.full_name) ||
              asText(row.client_name) ||
              `${tab === "inspection" ? "Inspection" : tab === "driver" ? "Driver" : "Client"} record`;
            const kind = asText(row.form_type);
            const rowId = typeof row.id === "number" ? row.id : Number(row.id);
            const tableId = tab === "driver" ? DRIVER_TABLE_ID : tab === "client" ? VEHICLE_CLIENT_TABLE_ID : INSPECTION_TABLE_ID;
            return (
              <div className={`record-card rc-${tab}`} key={String(row.id ?? Math.random())}>
                <div className="record-title">
                  <button
                    type="button"
                    className={`record-profile-btn${profileUrl ? " has-photo" : ""}`}
                    disabled={photoBusy === rowId}
                    title="Upload profile photo"
                    onClick={() => {
                      setUploadTarget({ tableId, rowId, existing: photos });
                      fileRef.current?.click();
                    }}
                  >
                    {profileUrl ? (
                      <img src={profileUrl} alt={String(title)} className="record-profile" />
                    ) : (
                      <span className="record-profile-empty">{photoBusy === rowId ? "…" : "📷"}</span>
                    )}
                  </button>
                  <span className="record-name">{title}</span>
                  {kind && <span className="tag tag-unchanged">{kind}</span>}
                  {tab === "inspection" &&
                    (() => {
                      const st = analysis.statusByRow[rowId];
                      if (!st) return null;
                      if (st.kind === "open")
                        return (
                          <span
                            className="tag open"
                            title="Post-deploy inspection not recorded yet for this vehicle"
                          >
                            Open · awaiting post
                          </span>
                        );
                      if (st.kind === "compared")
                        return st.anomalies > 0 ? (
                          <span className="tag anomaly" title="Item-by-item comparison found anomalies">
                            {st.anomalies} anomal{st.anomalies === 1 ? "y" : "ies"}
                          </span>
                        ) : (
                          <span className="tag compared" title="Item-by-item comparison — no anomalies">
                            Compared
                          </span>
                        );
                      return (
                        <span className="tag tag-unchanged" title="Post recorded without a matching pre-deploy record">
                          Standalone post
                        </span>
                      );
                    })()}
                  {tab === "client" && asText(row.amount_received) && (
                    <span className="tag tag-unchanged">GHS {asText(row.amount_received)}</span>
                  )}
                </div>
                <div className="record-meta">
                  {asText(row.vehicle_no) && <span className="record-chip">{asText(row.vehicle_no)}</span>}
                  {asText(row.vehicle_number) && !asText(row.vehicle_no) && (
                    <span className="record-chip">{asText(row.vehicle_number)}</span>
                  )}
                  {asText(row.created_on) && (
                    <span className="record-chip record-date">
                      {String(asText(row.created_on)).slice(0, 16).replace("T", " ")}
                    </span>
                  )}
                  {row.id != null && <span className="record-chip">#id {String(row.id)}</span>}
                  <button
                    type="button"
                    className="btn btn-ghost btn-small record-edit"
                    disabled={editBusy}
                    onClick={() => openEdit(row)}
                  >
                    ✎ Edit
                  </button>
                </div>
                {tab === "inspection" &&
                  (() => {
                    const matchPreId = analysis.matchByRow[rowId];
                    if (matchPreId == null) return null;
                    const cmp = analysis.panels[matchPreId];
                    if (!cmp) return null;
                    const isPost = String(asText(row.form_type) || "")
                      .toLowerCase()
                      .includes("post");
                    if (!isPost) return null;
                    const st = analysis.statusByRow[rowId];
                    const hasAnom = st?.kind === "compared" && st.anomalies > 0;
                    return (
                      <div className={`cmp-panel${hasAnom ? " has-anomaly" : ""}`}>
                        <div className="cmp-head">
                          <span className="cmp-title">
                            Pre ↔ Post comparison
                            <span>Pre #{matchPreId} vs Post #{rowId} — item-by-item check</span>
                          </span>
                        </div>
                        {renderCompareRows(cmp)}
                      </div>
                    );
                  })()}
                <div className="record-grid">
                  {entries.map(([k, v]) => {
                    const t = asText(v);
                    if (!t) return null;
                    return (
                      <div className="record-field" key={k}>
                        <span className="record-label">{humanLabel(k)}</span>
                        {renderLinkedValue(t, k)}
                      </div>
                    );
                  })}
                </div>
                {photos.length > 0 && (
                  <div className="record-photos">
                    {photos.map((ph, i) => (
                      <a key={i} href={ph.url} target="_blank" rel="noreferrer">
                        <img src={ph.url} alt={ph.name || `photo-${i}`} className="record-photo" />
                      </a>
                    ))}
                  </div>
                )}
                {editing && editing.tab === tab && editing.id === row.id && (
                  <div className="edit-panel">
                    <h3>
                      Edit {tab === "inspection" ? "inspection" : tab === "driver" ? "driver" : "client"} record
                    </h3>
                    {editError && <div className="photo-error">{editError}</div>}
                    <div className="row2">
                      {FIELDS_FOR[tab].map((f) => (
                        <div className="field" key={f.key as string}>
                          <label>{humanLabel(f.key as string)}</label>
                          {f.type === "select" ? (
                            <select
                              value={editValues[f.key as string] ?? ""}
                              onChange={(e) =>
                                setEditValues((v) => ({ ...v, [f.key as string]: e.target.value }))
                              }
                            >
                              <option value="">-</option>
                              {(f.options || []).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : f.type === "textarea" ? (
                            <textarea
                              value={editValues[f.key as string] ?? ""}
                              onChange={(e) =>
                                setEditValues((v) => ({ ...v, [f.key as string]: e.target.value }))
                              }
                            />
                          ) : (
                            <input
                              type={f.type === "date" ? "date" : "text"}
                              value={editValues[f.key as string] ?? ""}
                              onChange={(e) =>
                                setEditValues((v) => ({ ...v, [f.key as string]: e.target.value }))
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="edit-actions">
                      <button type="button" className="btn btn-ghost" onClick={closeEdit} disabled={editBusy}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={editBusy}>
                        {editBusy ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={onProfilePhotoPick}
        />
      </main>
    </>
  );
}