import type { EvidencePhoto } from "@/components/PhotoEvidence";
import { getPhoto } from "@/lib/db";
import type { LocalPhoto } from "@/lib/images";
import { INSPECTION_TABLE_ID, DRIVER_TABLE_ID, VEHICLE_CLIENT_TABLE_ID } from "@/lib/config";
import { PRE_ITEMS, POST_ITEMS } from "@/lib/items";

// Structural item shape accepted by submit (status may be typed or plain string —
// matches stored/outbox items as well as live form state).
export interface SubmitItem {
  status: string;
  note?: string;
  photos?: { blob: Blob; url?: string }[];
}
export type SubmitItems = Record<string, SubmitItem>;

export type SubmitResult = { ok: boolean; message: string };

function tableIsInspections(tableId: number): boolean {
  return tableId === INSPECTION_TABLE_ID;
}

// Human-readable labels for checklist item ids (kept out of the bundle's logic
// so records read like the paper form, not internal keys).
const ITEM_LABELS: Record<string, string> = {};
for (const it of [...PRE_ITEMS, ...POST_ITEMS]) ITEM_LABELS[it.id] = it.label;

// Upload one image blob to the server proxy, which forwards it to Baserow file
// storage. Returns the full upstream file object (for a "photos" file field) or
// null on failure.
async function uploadPhoto(
  blob: Blob,
  name: string,
): Promise<Record<string, unknown> | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25_000);
  try {
    const fd = new FormData();
    fd.append("file", blob, name);
    let res: Response;
    try {
      res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const js = (await res.json()) as Record<string, unknown>;
    if (!js.name && !js.url) return null;
    return js;
  } catch {
    return null;
  }
}

function driverTableRow(fields: Record<string, string>): Record<string, unknown> {
  return {
    full_name: fields.fullName || "",
    date_of_birth: fields.dob || "",
    ghana_card_no: fields.ghanaCardNo || "",
    residential_address: fields.residentialAddress || "",
    phone_number: fields.phoneNumber || "",
    emergency_contact: fields.emergencyContact || "",
    marital_status: fields.maritalStatus || "",
    drivers_license_no: fields.licenseNumber || "",
    license_class: fields.licenseClass || "",
    valid_license: fields.validLicense || "",
    years_experience: fields.yearsExperience || "",
    previous_employer: fields.previousEmployer || "",
    gps_directions: fields.gpsDirections || "",
    sales_targets: fields.salesTargets || "",
    guarantor_1_name: fields.g1Name || "",
    guarantor_1_relationship: fields.g1Relationship || "",
    guarantor_1_phone: fields.g1Phone || "",
    guarantor_1_occupation: fields.g1Occupation || "",
    guarantor_2_name: fields.g2Name || "",
    guarantor_2_relationship: fields.g2Relationship || "",
    guarantor_2_phone: fields.g2Phone || "",
    guarantor_2_occupation: fields.g2Occupation || "",
  };
}

function vehicleClientTableRow(fields: Record<string, string>): Record<string, unknown> {
  return {
    client_name: fields.clientName || "",
    phone_number: fields.phoneNumber || "",
    vehicle_number: fields.vehicleNumber || "",
    vehicle_type: fields.vehicleType || "",
    vehicle_description: fields.vehicleDescription || "",
    transaction_date: fields.transactionDate || "",
    transaction_time: fields.transactionTime || "",
    amount_received: fields.amountReceived || "",
    receipt_notes: fields.receiptNotes || "",
    google_drive_links: fields.googleDriveLinks || "",
  };
}

function inspectionsTableRow(
  fields: Record<string, string>,
  itemsState: SubmitItems,
  prefix: string,
  evidence: EvidencePhoto[],
  subject?: string,
): Record<string, unknown> {
  const lines: string[] = [];
  for (const [id, item] of Object.entries(itemsState)) {
    const photos = item.photos || [];
    if (!item.status && !item.note && photos.length === 0) continue;
    lines.push(
      `${ITEM_LABELS[id] || id}: ${item.status || "—"}${item.note ? ` — ${item.note}` : ""}`,
    );
  }
  return {
    form_type: prefix === "pre" ? "Pre-Trip Inspection" : "Post-Trip Inspection",
    date: fields.date || "",
    start_time: fields.startTime || "",
    driver_name: fields.driver || "",
    vehicle_no: fields.vehicleNo || "",
    trailer_no: fields.trailerNo || "",
    odometer: fields.odometer || "",
    inspector: fields.inspector || "",
    vehicle_type: fields.vehicleType || "",
    existing_damage: fields.existingDamage || "",
    items_report: lines.join("\n"),
    evidence_captions: evidence.map((ev) => ev.caption).join("\n"),
    driver_cert: fields.driverCert || "",
    supervisor_decision: fields.supervisorDecision || "",
    authorizer_name: fields.authorizerName || "",
    email_subject: subject || `${prefix === "pre" ? "PRE-TRIP" : "POST-TRIP"} — ${fields.vehicleNo || ""} — ${fields.driver || ""}`,
  };
}

// Send one submission to Baserow as a new row. Photos on the device are
// uploaded to the row's "photos" file field (when the table has one); the rest
// of the text always landing in the row. primaryPhoto (e.g. the driver
// portrait) is uploaded first so it leads the photos field.
export async function submitToBaserow(
  tableId: number,
  fields: Record<string, string>,
  itemsState: SubmitItems,
  prefix: string,
  evidence: EvidencePhoto[] = [],
  subject?: string,
  primaryPhoto?: LocalPhoto | null,
): Promise<SubmitResult> {
  const row =
    tableId === VEHICLE_CLIENT_TABLE_ID
      ? vehicleClientTableRow(fields)
      : tableIsInspections(tableId)
        ? inspectionsTableRow(fields, itemsState, prefix, evidence, subject)
        : driverTableRow(fields);

  // Upload on-device photos (primary + items + evidence, in order) to Baserow
  // and stash their file refs, ready for the "photos" file field.
  const photoBlobs: { blob: Blob; name: string }[] = [];
  if (primaryPhoto?.blob) {
    photoBlobs.push({ blob: primaryPhoto.blob, name: `driver_photo_${Date.now().toString(36)}.jpg` });
  }
  for (const [id, item] of Object.entries(itemsState)) {
    for (const p of item.photos || []) {
      if (p.blob) photoBlobs.push({ blob: p.blob, name: `${id}_${Date.now().toString(36)}.jpg` });
    }
  }
  for (const ev of evidence) {
    if (ev.photo?.blob) {
      photoBlobs.push({ blob: ev.photo.blob, name: `evidence_${Date.now().toString(36)}.jpg` });
    }
  }

  const uploaded: Record<string, unknown>[] = [];
  for (const pb of photoBlobs) {
    const fileRef = await uploadPhoto(pb.blob, pb.name);
    if (!fileRef) return { ok: false, message: "Photo upload to Baserow failed." };
    uploaded.push(fileRef);
  }
  if (uploaded.length) row.photos = uploaded;

// Omit empty fields so Baserow uses defaults (also avoids single-select
// errors for blank values).
const clean: Record<string, unknown> = {};
for (const [k, v] of Object.entries(row)) {
  if (v !== "") clean[k] = v;
}

  // Client-side timeout guard: if the server proxy hangs (e.g. upstream
  // Baserow unreachable), the form saves to the outbox instead of spinning
  // forever.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25_000);
  try {
    let res: Response;
    try {
      res = await fetch("/api/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, row: clean }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
      id?: number | null;
    } | null;
    if (!res.ok || !data?.ok) {
      return { ok: false, message: data?.message || `Server ${res.status}` };
    }
    return { ok: true, message: "Saved to DEGOONY database." };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, message: "Baserow timed out — check your connection." };
    }
    return { ok: false, message: err instanceof Error ? err.message : "Network error" };
  }
}

// Full backup (in-form button): Blobs → base64 data URLs so the JSON file is
// self-contained with photos.
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Types for the JSON-serializable backup file (not SubmitItem/EvidencePhoto).
type BackupItem = { status: string; note: string; photos: string[] };
type BackupEvidence = { caption: string; dataUrl: string };
type BackupShape = {
  prefix: string;
  queuedAt: string;
  fields: Record<string, string>;
  items: Record<string, BackupItem>;
  evidence: BackupEvidence[];
  primaryPhoto?: string;
};

async function serializeForBackup(
  items: SubmitItems,
  evidence: EvidencePhoto[],
  primaryPhoto?: LocalPhoto | null,
): Promise<BackupShape> {
  const serializedItems: Record<string, BackupItem> = {};
  for (const [id, it] of Object.entries(items)) {
    const photos = (it.photos || []).filter((p) => p?.blob);
    serializedItems[id] = {
      status: it.status,
      note: it.note ?? "",
      photos: await Promise.all(photos.map((p) => blobToDataUrl(p.blob!))),
    };
  }
  const serializedEvidence = await Promise.all(
    evidence.map(async (ev) => ({
      caption: ev.caption,
      dataUrl: ev.photo?.blob ? await blobToDataUrl(ev.photo.blob) : "",
    })),
  );
  const serialized: BackupShape = {
    prefix: "",
    queuedAt: "",
    fields: {},
    items: serializedItems,
    evidence: serializedEvidence,
  };
  if (primaryPhoto?.blob) serialized.primaryPhoto = await blobToDataUrl(primaryPhoto.blob);
  return serialized;
}

export async function downloadBackup(
  payload: { prefix: string; queuedAt: string; fields: Record<string, string>; items: SubmitItems; evidence: EvidencePhoto[]; primaryPhoto?: LocalPhoto | null },
  filename = "inspection.json",
): Promise<void> {
  const serialized = await serializeForBackup(payload.items, payload.evidence, payload.primaryPhoto);
  serialized.prefix = payload.prefix;
  serialized.queuedAt = payload.queuedAt;
  serialized.fields = payload.fields;
  const blob = new Blob([JSON.stringify(serialized, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Rehydrate stored photo IDs → full LocalPhoto blobs (used by Outbox to
// resubmit an entry after a reload).
export type ResolvedItemPhoto = { blob: Blob; url?: string };
export type ResolvedItem = { status: string; note: string; photos: ResolvedItemPhoto[] };
export type ResolvedEvidence = { caption: string; photo: LocalPhoto };

export async function rehydrateEntryPhotos(
  items: Record<string, { status: string; note: string; photos: string[] }>,
  evidence: { caption: string; id: string }[],
  primaryPhotoId?: string,
): Promise<{ items: SubmitItems; resolvedEvidence: ResolvedEvidence[]; resolvedPrimaryPhoto: LocalPhoto | null }> {
  const resolvedItems: SubmitItems = {};
  for (const [id, it] of Object.entries(items)) {
    const photos = (await Promise.all(
      (it.photos || []).map(async (pid) => {
        const blob = await getPhoto(pid);
        return blob ? { blob } : null;
      }),
    )).filter(Boolean) as ResolvedItemPhoto[];
    resolvedItems[id] = { status: it.status, note: it.note ?? "", photos };
  }
  const resolvedEvidence = (await Promise.all(
    evidence.map(async (ev) => {
      const blob = await getPhoto(ev.id);
      return blob ? { caption: ev.caption, photo: { id: ev.id, blob, url: "" } } : null;
    }),
  )).filter(Boolean) as ResolvedEvidence[];
  let resolvedPrimaryPhoto: LocalPhoto | null = null;
  if (primaryPhotoId) {
    const blob = await getPhoto(primaryPhotoId);
    if (blob) resolvedPrimaryPhoto = { id: primaryPhotoId, blob, url: "" };
  }
  return { items: resolvedItems, resolvedEvidence, resolvedPrimaryPhoto };
}
