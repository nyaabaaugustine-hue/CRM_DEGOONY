"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import HomeLink from "@/components/HomeLink";
import VehicleClientForm from "@/components/VehicleClientForm";
import { VEHICLE_CLIENT_TABLE_ID } from "@/lib/config";
import { cacheRows, loadCachedEntry } from "@/lib/recordCache";

type Rec = Record<string, unknown>;

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

function filesOf(v: unknown): { url: string; name?: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (x): x is Record<string, unknown> =>
        !!x && typeof x === "object" && typeof (x as Record<string, unknown>).url === "string",
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

function renderLinkedValue(value: string): React.ReactNode {
  return value.split(/\s+/).filter(Boolean).map((tok, i) =>
    /^https?:\/\//i.test(tok) ? (
      <a
        key={i}
        className="record-link"
        href={tok}
        target="_blank"
        rel="noreferrer"
        title="Open document"
      >
        {tok.replace(/^https?:\/\/(www\.)?/, "")}
        <span className="record-link-arrow">↗</span>
      </a>
    ) : (
      <span key={i}>{i > 0 ? " " : ""}{tok}</span>
    ),
  );
}

export default function VehicleClientPage() {
  const [mode, setMode] = useState<"list" | "new">("list");
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState<{ savedAt: number } | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rows?table=${VEHICLE_CLIENT_TABLE_ID}`);
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const js = (await res.json()) as { results?: Rec[]; error?: string };
      if (js.error) throw new Error(js.error);
      const data = (
        (js.results || []).sort((a, b) => {
          const na = typeof a.id === "number" ? a.id : Number.NEGATIVE_INFINITY;
          const nb = typeof b.id === "number" ? b.id : Number.NEGATIVE_INFINITY;
          return nb - na;
        })
      );
      setRows(data);
      setOffline(null);
      await cacheRows("client", data);
    } catch (e) {
      // Live fetch failed — show the copy of the Baserow data saved in this
      // app (IndexedDB) so a brief network blip never blanks the list.
      const cached = await loadCachedEntry("client");
      if (cached && cached.rows.length > 0) {
        setRows(cached.rows);
        setOffline({ savedAt: cached.savedAt });
      } else {
        setError(e instanceof Error ? e.message : "Could not load client transactions.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) =>
        Object.entries(r)
          .filter(([k]) => k !== "photos" && k !== "Transaction_Documents")
          .map(([, v]) => asText(v) || "")
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : rows;

  if (mode === "new") {
    return <VehicleClientForm />;
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
        <div className="card">
          <div className="records-head">
            <div className="records-title">
              <h2>Client transactions</h2>
              <span className="records-sub">
                {q
                  ? `${visible.length} of ${rows.length} client transactions match “${search.trim()}”`
                  : `${rows.length} client transaction${rows.length === 1 ? "" : "s"}${offline ? ` · offline copy saved ${new Date(offline.savedAt).toLocaleString()}` : " · DEGOONY database (vehicle client transaction table)"}`}
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client transactions…"
                enterKeyHint="search"
              />
              {search && (
                <button type="button" className="search-clear" onClick={() => setSearch("")} aria-label="Clear search">
                  ×
                </button>
              )}
            </label>
          </div>

          <div className="vc-actions">
            <button type="button" className="btn btn-primary btn-small" onClick={() => setMode("new")}>
              ＋ New transaction
            </button>
            <Link href="/records">
              <button type="button" className="btn btn-ghost btn-small">
                View saved submissions
              </button>
            </Link>
          </div>

          {error && <div className="photo-error">{error}</div>}
          {offline && !error && (
            <div className="photo-notice demo-notice">
              Offline — showing the copy of your client transactions saved in this app{" "}
              <strong>{new Date(offline.savedAt).toLocaleString()}</strong>.
            </div>
          )}
          {!error && !offline && rows.length === 0 && !loading && (
            <div className="empty-state">
              <span className="empty-orb" />
              <p>
                <strong>No client transactions yet.</strong>
              </p>
              <p>Recording a transaction will show it here for management.</p>
              <button type="button" className="btn btn-primary btn-small" onClick={() => setMode("new")}>
                Record a transaction
              </button>
            </div>
          )}
          {!loading && q && visible.length === 0 && rows.length > 0 && (
            <div className="empty-state">
              <span className="empty-orb" />
              <p>
                <strong>No results for “{search.trim()}”.</strong>
              </p>
              <p>Try a different name, vehicle or keyword.</p>
            </div>
          )}

          {loading && rows.length === 0 ? (
            <>
              <div className="skel" />
              <div className="skel" />
              <div className="skel" />
            </>
          ) : (
            visible.map((row) => {
              const photos = filesOf(row.photos);
              const docs = filesOf(row.Transaction_Documents);
              const title = asText(row.client_name) || "Client transaction";
              const created = asText(row.created_on);
              return (
                <div className="record-card rc-client" key={String(row.id ?? Math.random())}>
                  <div className="record-title">
                    <span className="record-name">{title}</span>
                    {asText(row.vehicle_type) && <span className="tag tag-unchanged">{asText(row.vehicle_type)}</span>}
                    {asText(row.amount_received) && (
                      <span className="tag tag-unchanged">GHS {asText(row.amount_received)}</span>
                    )}
                  </div>
                  <div className="record-meta">
                    {asText(row.vehicle_vin_number) && (
                      <span className="record-chip">{asText(row.vehicle_vin_number)}</span>
                    )}
                    {asText(row.phone_number) && <span className="record-chip">{asText(row.phone_number)}</span>}
                    {created && (
                      <span className="record-chip record-date">{String(created).slice(0, 16).replace("T", " ")}</span>
                    )}
                    {row.id != null && <span className="record-chip">#id {String(row.id)}</span>}
                  </div>
                  <div className="record-grid">
                    {asText(row.transaction_date) && (
                      <div className="record-field">
                        <span className="record-label">Transaction Date</span>
                        {asText(row.transaction_date)}
                      </div>
                    )}
                    {asText(row.transaction_time) && (
                      <div className="record-field">
                        <span className="record-label">Transaction Time</span>
                        {asText(row.transaction_time)}
                      </div>
                    )}
                    {asText(row.vehicle_description) && (
                      <div className="record-field">
                        <span className="record-label">Vehicle Description</span>
                        {asText(row.vehicle_description)}
                      </div>
                    )}
                    {asText(row.receipt_notes) && (
                      <div className="record-field">
                        <span className="record-label">Receipt Notes</span>
                        {asText(row.receipt_notes)}
                      </div>
                    )}
                    {asText(row.google_drive_links) && (
                      <div className="record-field">
                        <span className="record-label">Google Drive Documents</span>
                        {renderLinkedValue(asText(row.google_drive_links) as string)}
                      </div>
                    )}
                    {asText(row.Transaction_Documents) && (
                      <div className="record-field">
                        <span className="record-label">Transaction Documents</span>
                        {docs.length > 0
                          ? docs.map((d, i) => (
                              <a key={i} className="record-link" href={d.url} target="_blank" rel="noreferrer">
                                {d.name || d.url.replace(/^https?:\/\/(www\.)?/, "")}
                                <span className="record-link-arrow">↗</span>
                              </a>
                            ))
                          : humanLabel("Transaction_Documents")}
                      </div>
                    )}
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
                </div>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}