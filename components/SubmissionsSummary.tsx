"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  INSPECTION_TABLE_ID,
  DRIVER_TABLE_ID,
  VEHICLE_CLIENT_TABLE_ID,
} from "@/lib/config";

type Stat = { key: string; label: string; value: number | null };

const STAT_TABLES: { key: string; label: string; id: number }[] = [
  { key: "inspection", label: "Inspections", id: INSPECTION_TABLE_ID },
  { key: "driver", label: "Drivers", id: DRIVER_TABLE_ID },
  { key: "client", label: "Clients", id: VEHICLE_CLIENT_TABLE_ID },
];

function countFrom(json: unknown): number | null {
  const res = (json as { results?: unknown[] } | null)?.results;
  return Array.isArray(res) ? res.length : null;
}

export default function SubmissionsSummary() {
  const [stats, setStats] = useState<Stat[]>(() =>
    STAT_TABLES.map((t) => ({ key: t.key, label: t.label, value: null })),
  );

  const load = useCallback(async () => {
    try {
      const jsons = await Promise.all(
        STAT_TABLES.map((t) =>
          fetch(`/api/rows?table=${t.id}`)
            .then((r) => r.json())
            .catch(() => undefined),
        ),
      );
      setStats(
        STAT_TABLES.map((t, idx) => ({
          key: t.key,
          label: t.label,
          value: countFrom(jsons[idx]),
        })),
      );
    } catch {
      // keep counts as "—"; card still links to /records
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Link href="/records" className="dash-subs" aria-label="Open saved submissions">
      <span className="dash-subs-head">
        <span className="dash-subs-ico">🗂️</span>
        <span className="dash-subs-head-text">
          <span className="dash-subs-label">SAVED SUBMISSIONS</span>
          <span className="dash-subs-sub">Open the records dashboard</span>
        </span>
        <span className="dash-subs-arrow">›</span>
      </span>
      <span className="dash-subs-stats">
        {stats.map((s) => (
          <span className="dash-stat" key={s.key}>
            <b>{s.value ?? "—"}</b> {s.label}
          </span>
        ))}
      </span>
    </Link>
  );
}