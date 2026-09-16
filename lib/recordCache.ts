// IndexedDB persistence for the records view. Every time fresh rows are loaded
// from Baserow they are snapshotted here, so the app keeps showing the data
// even when the network or Baserow is unreachable — a persistent in-app copy.

type Rec = Record<string, unknown>;
export type CacheKey = "inspection" | "driver" | "client";

const DB_NAME = "evergreen_records";
const DB_VERSION = 1;
const STORE = "tables";

let dbReady: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("no indexedDB"));
  if (!dbReady) {
    dbReady = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbReady;
}

type Entry = { key: CacheKey; rows: Rec[]; savedAt: number };

// Persist a snapshot of a table's rows (capped so storage stays small).
export async function cacheRows(key: CacheKey, rows: Rec[], maxRows = 5000): Promise<void> {
  try {
    const db = await openDb();
    const entry: Entry = { key, rows: rows.slice(0, maxRows), savedAt: Date.now() };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // storage unavailable — ignore, live data still displays
  }
}

async function loadEntry(key: CacheKey): Promise<Entry | null> {
  try {
    const db = await openDb();
    const entry = (await new Promise<Entry | null>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Entry) || null);
      req.onerror = () => reject(req.error);
    })) as Entry | null;
    return entry && Array.isArray(entry.rows) ? entry : null;
  } catch {
    return null;
  }
}

export async function loadCachedRows(key: CacheKey): Promise<Rec[] | null> {
  const entry = await loadEntry(key);
  return entry ? entry.rows : null;
}

export async function loadCachedEntry(key: CacheKey): Promise<{ rows: Rec[]; savedAt: number } | null> {
  const entry = await loadEntry(key);
  return entry ? { rows: entry.rows, savedAt: entry.savedAt } : null;
}

// Load cached copies for all three tabs. Returns null when nothing is cached.
export async function loadCachedAll(): Promise<{
  inspection: Rec[];
  driver: Rec[];
  client: Rec[];
  savedAt: number;
} | null> {
  const [inspection, driver, client] = await Promise.all([
    loadEntry("inspection"),
    loadEntry("driver"),
    loadEntry("client"),
  ]);
  if (!inspection && !driver && !client) return null;
  const savedAt = Math.max(inspection?.savedAt || 0, driver?.savedAt || 0, client?.savedAt || 0);
  return {
    inspection: inspection?.rows || [],
    driver: driver?.rows || [],
    client: client?.rows || [],
    savedAt,
  };
}