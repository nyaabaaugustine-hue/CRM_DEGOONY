import { NextRequest } from "next/server";
import { baserow } from "@/lib/baserow";

// Baserow sits behind Cloudflare, which blocks non-browser user agents (1010/502).
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Authorization: `Token ${baserow.token}`,
};

function okResponse(body: Record<string, unknown>) {
  return Response.json(body);
}

// Tables store images in differently-named file fields (client: "photos",
// driver: "driver_image"/"Image", etc.). These helpers discover the actual
// file field name(s) so the app can always send rows with `photos` and the
// server maps it to the right field — and folds them back into `photos` on GET.
const FILE_FIELD_CACHE = new Map<number, { names: string[]; ts: number }>();
const FILE_FIELD_TTL = 120_000;

async function fileFieldNames(tableId: number): Promise<string[]> {
  const hit = FILE_FIELD_CACHE.get(tableId);
  if (hit && Date.now() - hit.ts < FILE_FIELD_TTL) return hit.names;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(`${baserow.base}/api/database/fields/table/${tableId}/`, {
        headers: HEADERS,
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return [];
    const fields = (await res.json()) as Array<{ name?: string; type?: string }>;
    const names = (fields || [])
      .filter((f) => f.type === "file")
      .map((f) => f.name || "")
      .filter(Boolean);
    FILE_FIELD_CACHE.set(tableId, { names, ts: Date.now() });
    return names;
  } catch {
    return [];
  }
}

function pickPhotoField(names: string[]): string | null {
  for (const n of names) if (n === "photos") return n;
  for (const n of names) if (n.toLowerCase().includes("photo")) return n;
  for (const n of names) if (n.toLowerCase().includes("image")) return n;
  return names[0] || null;
}

// Rename `photos` in an incoming row to the table's actual file field name.
async function mapPhotoField(
  tableId: number,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (typeof row.photos !== "undefined" && row.photos !== null) {
    const target = pickPhotoField(await fileFieldNames(tableId));
    if (target && target !== "photos") {
      const { photos, ...rest } = row;
      rest[target] = photos;
      return rest;
    }
  }
  return row;
}

// Fold every file-field array on a row into a single canonical `photos` key.
function normalizePhotoFields(row: Record<string, unknown>, fieldNames: string[]): Record<string, unknown> {
  const merged: Record<string, unknown>[] = [];
  for (const n of [...fieldNames, "photos"]) {
    const v = row[n];
    if (Array.isArray(v)) merged.push(...(v as Record<string, unknown>[]));
  }
  const byUrl = new Map<string, Record<string, unknown>>();
  for (const f of merged) {
    if (f && typeof f === "object" && typeof f.url === "string") byUrl.set(f.url, f);
  }
  return { ...row, photos: [...byUrl.values()] };
}

// Short-lived server-side copy of each table's row list so repeated page loads
// (and the offline cache refresh) don't hammer Baserow and hit its rate limit.
// Cleared whenever a PATCH/POST changes that table.
const LIST_CACHE = new Map<string, { at: number; body: Record<string, unknown> }>();
const LIST_TTL = 60_000;

function invalidateList(tableId: number) {
  LIST_CACHE.delete(`${tableId}:all`);
}

// GET /api/rows?table=<id>  →  { results: [...] } (Baserow row list)
export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table") || "";
  if (!/^\d+$/.test(table)) {
    return okResponse({ results: [], error: "Invalid table." });
  }
  const cacheKey = `${table}:all`;
  const cached = LIST_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < LIST_TTL) return okResponse(cached.body);
  try {
    const fileNames = await fileFieldNames(Number(table));
    const seen = new Set<number>();
    const results: Record<string, unknown>[] = [];
    let page = 1;
    for (;;) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 15_000);
      let res: Response;
      try {
        res = await fetch(
          `${baserow.base}/api/database/rows/table/${table}/?user_field_names=true&size=100&page=${page}`,
          { headers: HEADERS, signal: ac.signal },
        );
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) return okResponse({ results: [], error: `Baserow ${res.status}` });
      const json = (await res.json()) as {
        results?: unknown[];
        next?: string | null;
        count?: number;
      };
      const batch = Array.isArray(json.results) ? json.results : [];
      for (const r of batch as Record<string, unknown>[]) {
        const id = typeof r.id === "number" ? r.id : null;
        if (id !== null && seen.has(id)) continue;
        if (id !== null) seen.add(id);
        results.push(normalizePhotoFields(r, fileNames));
      }
      if (!json.next || batch.length === 0) {
        const body: Record<string, unknown> = {
          count: typeof json.count === "number" ? json.count : results.length,
          next: null,
          previous: null,
          results,
        };
        LIST_CACHE.set(cacheKey, { at: Date.now(), body });
        return okResponse(body);
      }
      page += 1;
    }
  } catch {
    return okResponse({ results: [], error: "Could not reach Baserow." });
  }
}

// PATCH /api/rows  body { tableId, rowId, row }  →  edit an existing row
export async function PATCH(req: NextRequest) {
  let body: { tableId?: unknown; rowId?: unknown; row?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return okResponse({ ok: false, message: "Bad request body." });
  }
  const { tableId, rowId, row } = body;
  if (
    !Number.isInteger(tableId) ||
    !Number.isInteger(rowId) ||
    !row ||
    typeof row !== "object"
  ) {
    return okResponse({ ok: false, message: "Bad request body." });
  }
  try {
    const fileNames = await fileFieldNames(tableId as number);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20_000);
    let res: Response;
    try {
      res = await fetch(
        `${baserow.base}/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`,
        {
          method: "PATCH",
          headers: { ...HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify(await mapPhotoField(tableId as number, row as Record<string, unknown>)),
          signal: ac.signal,
        },
      );
    } finally {
      clearTimeout(timer);
    }
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      const msg =
        (data && ((data.error as string) || (data.detail as string))) ||
        `Baserow ${res.status}`;
      return okResponse({ ok: false, message: msg });
    }
    invalidateList(tableId as number);
    return okResponse({
      ok: true,
      message: "Record updated.",
      id: data && typeof data.id === "number" ? data.id : null,
    });
  } catch {
    return okResponse({ ok: false, message: "Network error reaching Baserow." });
  }
}

// POST /api/rows  body { tableId, row }  →  { ok, message, id? }
export async function POST(req: NextRequest) {
  let body: { tableId?: unknown; row?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return okResponse({ ok: false, message: "Bad request body." });
  }
  const tableId = body.tableId;
  const row = body.row;
  if (!Number.isInteger(tableId) || !row || typeof row !== "object") {
    return okResponse({ ok: false, message: "Bad request body." });
  }
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20_000);
    let res: Response;
    try {
      res = await fetch(
        `${baserow.base}/api/database/rows/table/${tableId}/?user_field_names=true`,
        {
          method: "POST",
          headers: { ...HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify(await mapPhotoField(tableId as number, row as Record<string, unknown>)),
          signal: ac.signal,
        },
      );
    } finally {
      clearTimeout(timer);
    }
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      const msg =
        (data && ((data.error as string) || (data.detail as string))) ||
        `Baserow ${res.status}`;
      return okResponse({ ok: false, message: msg });
    }
    invalidateList(tableId as number);
    return okResponse({
      ok: true,
      message: "Saved to DEGOONY database.",
      id: data && typeof data.id === "number" ? data.id : null,
    });
  } catch {
    return okResponse({ ok: false, message: "Network error reaching Baserow." });
  }
}