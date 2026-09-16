"use client";

import { useCallback, useEffect, useState } from "react";
import type { ItemDef, ItemState } from "@/lib/items";
import type { EvidencePhoto } from "@/components/PhotoEvidence";
import { submitToBaserow, downloadBackup } from "@/lib/submit";
import type { SubmitItems } from "@/lib/submit";
import { INSPECTION_TABLE_ID, DRIVER_TABLE_ID, VEHICLE_CLIENT_TABLE_ID } from "@/lib/config";
import { saveDraft, draftKey, pushOutbox, rememberDraftKey, loadLatestDraft, clearLatestDraft } from "@/lib/store";
import type { QueuedSubmission } from "@/lib/store";
import { loadSavedPhoto } from "@/lib/images";
import type { LocalPhoto } from "@/lib/images";

export type ValidationEntry = { field: keyof FieldsState; label: string; rule: (v: string) => boolean };

type BaseFields = Record<string, string>;

export interface FieldsState {
  date: string;
  driver: string;
  vehicleNo: string;
  [k: string]: string;
}

export interface FormOptions {
  prefix: string;
  defaultFields: BaseFields;
  validation: ValidationEntry[];
  extraFields?: (fields: BaseFields) => Record<string, string>;
  // Custom subject/form type labels for outbox retries.
  subject?: (fields: BaseFields) => string;
  formType?: string;
}

// Baserow destination table for a form prefix.
function tableIdForPrefix(prefix: string): number {
  if (prefix === "driver") return DRIVER_TABLE_ID;
  if (prefix === "vehicleClient") return VEHICLE_CLIENT_TABLE_ID;
  return INSPECTION_TABLE_ID;
}

function emptyItems(items: ItemDef[]): Record<string, ItemState> {
  const s: Record<string, ItemState> = {};
  items.forEach((it) => (s[it.id] = { status: "", note: "", photos: [] }));
  return s;
}

// Convert live in-memory payload (Blob photos) into the stored/text form that
// persists to localStorage: photo blobs stay in IndexedDB; here we keep only
// their IDs (tiny strings) so drafts and the outbox can rehydrate images after
// a reload. Blobs are never written to localStorage.
function toStoredForm(payload: PayloadFull, opts: FormOptions): QueuedSubmission {
  const items: QueuedSubmission["items"] = {};
  for (const [id, it] of Object.entries(payload.items)) {
    items[id] = {
      status: it.status,
      note: it.note ?? "",
      photos: (it.photos || []).map((p) => p.id),
    };
  }
  return {
    id: payload.id,
    queuedAt: payload.queuedAt,
    prefix: payload.prefix,
    tableId: tableIdForPrefix(opts.prefix),
    subject: opts.subject ? opts.subject(payload.fields) : undefined,
    formType: opts.formType,
    fields: payload.fields,
    items,
    evidence: payload.evidence.map((ev) => ({ caption: ev.caption, id: ev.photo.id })),
    primaryPhoto: payload.primaryPhoto ? payload.primaryPhoto.id : undefined,
  };
}

// Full in-memory payload carries Blob photo refs.
type PayloadFull = {
  id: string;
  queuedAt: string;
  prefix: string;
  fields: Record<string, string>;
  items: Record<string, ItemState>;
  evidence: EvidencePhoto[];
  primaryPhoto: LocalPhoto | null;
};

export function useInspectionForm({ prefix, defaultFields, validation, extraFields, subject, formType }: FormOptions) {
  const [fields, setFields] = useState<BaseFields>(() => defaultFields);
  const [items, setItems] = useState<Record<string, ItemState>>(() => emptyItems([]));
  const [evidence, setEvidence] = useState<EvidencePhoto[]>([]);
  const [primaryPhoto, setPrimaryPhoto] = useState<LocalPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justQueued, setJustQueued] = useState(false);

  const setField = useCallback((k: string, v: string) => {
    setFields((p) => ({ ...p, [k]: v }));
  }, []);

  const setItem = useCallback((id: string, patch: Partial<ItemState>) => {
    setItems((p) => ({ ...p, [id]: { ...(p[id] || { status: "", note: "", photos: [] }), ...patch } }));
  }, []);

  const setEvidenceList = useCallback((list: EvidencePhoto[]) => setEvidence(list), []);

  const removeEvidence = useCallback((i: number) => setEvidence((p) => p.filter((_, idx) => idx !== i)), []);

  // Draft autosave (debounced) — text + photo IDs only, never blobs in localStorage.
  useEffect(() => {
    const t = setTimeout(() => {
      const key = draftKey(prefix, fields.vehicleNo || fields.fullName || "");
      const entry = toStoredForm(
        {
          id: "draft",
          queuedAt: new Date().toISOString(),
          prefix,
          fields,
          items,
          evidence,
          primaryPhoto,
        },
        { prefix, defaultFields, validation, extraFields, subject, formType },
      );
      saveDraft(key, entry);
      rememberDraftKey(prefix, key);
    }, 600);
    return () => clearTimeout(t);
  }, [fields, items, evidence, primaryPhoto, prefix, subject, formType, defaultFields, validation, extraFields]);

  // Restore a text-only draft and rehydrate its photo blobs from IndexedDB.
  const restore = useCallback(
    async (itemDefs: ItemDef[]): Promise<QueuedSubmission | null> => {
      const { key, value: draft } = loadLatestDraft<QueuedSubmission>(prefix);
      if (!draft) {
        setItems(emptyItems(itemDefs));
        return null;
      }

      const base = emptyItems(itemDefs);
      const photoLookup = new Map<string, LocalPhoto>();
      await Promise.all(
        Object.values(draft.items)
          .flatMap((it) => it.photos || [])
          .concat(draft.evidence.map((ev) => ev.id))
          .concat(draft.primaryPhoto ? [draft.primaryPhoto] : [])
          .filter(Boolean)
          .map(async (pid) => {
            const p = await loadSavedPhoto(pid);
            if (p) photoLookup.set(pid, p);
          }),
      );

      for (const id of itemDefs.map((d) => d.id)) {
        const st = draft.items[id];
        if (!st) continue;
        const raw = st.status;
        const status: ItemState["status"] =
          raw === "OK" || raw === "DEFECT" || raw === "N/A" || raw === "" ? raw : "";
        base[id] = {
          status,
          note: st.note ?? "",
          photos: (st.photos || []).map((pid) => photoLookup.get(pid)).filter(Boolean) as ItemState["photos"],
        };
      }
      setItems(base);
      if (draft.fields) setFields(draft.fields);
      const restoredEvidence = draft.evidence
        .map((ev) => {
          const p = photoLookup.get(ev.id);
          return p ? { caption: ev.caption, photo: p } : null;
        })
        .filter(Boolean) as EvidencePhoto[];
      setEvidence(restoredEvidence);
      if (draft.primaryPhoto) {
        const p = photoLookup.get(draft.primaryPhoto);
        setPrimaryPhoto(p || null);
      }
      return draft;
    },
    [prefix],
  );

  const validate = useCallback((): string | null => {
    for (const entry of validation) {
      const val = fields[entry.field] || "";
      if (!entry.rule(val)) return `${entry.label} is required.`;
    }
    return null;
  }, [fields, validation]);

  const buildPayload = useCallback(
    (): PayloadFull => ({
      id: "", // assigned when queued
      queuedAt: new Date().toISOString(),
      prefix,
      fields: { ...fields, ...(extraFields ? extraFields(fields) : {}) },
      items,
      evidence,
      primaryPhoto,
    }),
    [fields, items, evidence, primaryPhoto, prefix, extraFields],
  );

const submit = useCallback(async (): Promise<boolean> => {
    const errMsg = validate();
    if (errMsg) {
      setError(errMsg);
      return false;
    }
    setError(null);
    setBusy(true);
    setJustQueued(false);

    const payload = buildPayload();
    const result = await submitToBaserow(
      tableIdForPrefix(prefix),
      payload.fields,
      payload.items as unknown as SubmitItems,
      prefix,
      payload.evidence,
      subject ? subject(payload.fields) : undefined,
      payload.primaryPhoto,
    );

    if (result.ok) {
      clearLatestDraft(prefix);
      // Photos intentionally stay saved on the device (IndexedDB) after a
      // successful submit so staff can still share them via WhatsApp.
      setBusy(false);
      return true;
    }

    // Offline/failure → queue for retry and offer backup, never lose data.
    // The outbox stores text + photo IDs; blobs stay in IndexedDB so images
    // survive and can be re-sent later.
    pushOutbox(toStoredForm(payload, { prefix, defaultFields, validation, extraFields, subject, formType }));
    setJustQueued(true);
    setBusy(false);
    setError(`Baserow error — ${result.message}. Saved to outbox; you can retry.`);
    return false;
  }, [validate, buildPayload, prefix, subject, formType, defaultFields, validation, extraFields]);

  const download = useCallback(
    async (filename?: string) => {
      const payload = buildPayload();
      const ref = fields.vehicleNo || fields.fullName || "submission";
      await downloadBackup(
        payload,
        filename || `${prefix}_${ref}_${fields.date || ""}.json`,
      );
    },
    [buildPayload, prefix, fields],
  );

  return {
    fields,
    items,
    evidence,
    primaryPhoto,
    error,
    busy,
    justQueued,
    setJustQueued,
    setField,
    setItem,
    setEvidence: setEvidenceList,
    removeEvidence,
    setPrimaryPhoto,
    restore,
    submit,
    download,
    setError,
  };
}
