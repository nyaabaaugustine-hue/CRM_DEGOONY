// Pre ↔ Post deployment comparison.
//
// Inspections are recorded by the same staff device, but each submit becomes
// its own Baserow row in the INSPECTION table (form_type = Pre/Post). The
// boss's rule: a PRE record stays "OPEN" until a POST is recorded for the same
// vehicle; once paired, the two checklists are compared item-by-item so
// anomalies (new defects, persistent defects) are surfaced.

export type InspectionRow = {
  id: number;
  created_on?: string;
  date?: string;
  vehicle_no?: string;
  form_type?: string;
  items_report?: string;
} & Record<string, unknown>;

export type ParsedItem = { label: string; status: string; note: string };

export type PairedInspection = {
  vehicleNo: string;
  pre: InspectionRow;
  post: InspectionRow;
};

export type Verdict =
  | "NEW_DEFECT" // OK/— → DEFECT while out: anomaly
  | "PERSISTENT" // DEFECT → DEFECT: carried through
  | "RESOLVED" // DEFECT → OK on return: fixed
  | "CLEAR" // OK → OK
  | "N_A" // either side not assessed
  | "UNRECORDED"; // no usable status on the post side

export type CompareRow = {
  system: string;
  preLabels: string[];
  postLabels: string[];
  preStatus: string;
  postStatus: string;
  notes: string[];
  verdict: Verdict;
};

export type InspStatus =
  | { kind: "open" } // pre recorded, no post yet
  | { kind: "compared"; anomalies: number }
  | { kind: "standalone" }; // post without a preceding pre

export type Summary = { open: number; compared: number; anomalies: number };

export type Analysis = {
  summary: Summary;
  statusByRow: Record<number, InspStatus>;
  panels: Record<number, CompareRow[]>; // keyed by PRE row id
  matchByRow: Record<number, number>; // pre↔post id pairs
};

// Statuses recorded on the form.
const STATUS_RE = /^(OK|DEFECT|N\/A)$/i;

// Canonical systems shared across the (different) pre/post checklists. Each pre
// label group is compared against its post label group.
const SYSTEMS: { label: string; pre: string[]; post: string[] }[] = [
  {
    label: "Brakes / steering / controls",
    pre: ["Brakes / parking brakes", "Steering / controls"],
    post: ["Brakes / steering / controls"],
  },
  {
    label: "Tyres / wheels",
    pre: ["Front tyre / wheel condition", "Rear tyre / wheel condition", "Tyre pressure / visible integrity"],
    post: ["Tyres / wheels"],
  },
  {
    label: "Lights / signals / horn",
    pre: ["Headlight / rear lights", "Indicators / signals", "Horn"],
    post: ["Lights / signals / horn"],
  },
  {
    label: "Mirrors",
    pre: ["Driver-side mirror", "Passenger-side / other mirror(s)"],
    post: ["Mirrors"],
  },
  {
    label: "Battery / charging",
    pre: ["Battery charge / condition / security", "Charging connection / cable condition"],
    post: ["Battery / charging condition"],
  },
  {
    label: "Dashboard / warning indicators",
    pre: ["Dashboard / warning indicators"],
    post: ["Dashboard / warning indicators"],
  },
  {
    label: "GPS / tracking (where fitted)",
    pre: ["GPS / tracking (where fitted)"],
    post: ["GPS / tracking (where fitted)"],
  },
  {
    label: "Seats / passenger area",
    pre: ["Seats / passenger area"],
    post: ["Seats / passenger area"],
  },
  {
    label: "Body panels / scratches / dents",
    pre: ["Body panels / visible scratches / dents"],
    post: ["Body panels / scratches / dents"],
  },
  {
    label: "Loose, broken or missing components",
    pre: ["Loose, broken or missing components"],
    post: ["Loose, broken or missing components"],
  },
  {
    label: "Unusual sound / vibration / smell",
    pre: ["Unusual sound / vibration / smell"],
    post: ["Unusual sound / vibration / smell"],
  },
  {
    label: "Cleanliness / readiness",
    pre: ["Cleanliness / readiness"],
    post: ["Cleanliness / readiness"],
  },
  {
    label: "Other",
    pre: ["Other"],
    post: ["Other"],
  },
];

export function isPostRow(row: InspectionRow): boolean {
  const ftRaw = row.form_type;
  const ft =
    ftRaw && typeof ftRaw === "object" && "value" in ftRaw
      ? String((ftRaw as { value?: unknown }).value || "")
      : String(ftRaw || "");
  return ft.trim().toLowerCase().includes("post");
}

function norm(vehicleNo: unknown): string {
  return String(vehicleNo || "").trim().toUpperCase();
}

function rowStamp(row: InspectionRow): string {
  return String(row.created_on || row.date || "");
}

// Split a stored items_report into { label, status, note } lines. The on-device
// submit writes one line per recorded item: "Label: STATUS — note".
export function parseItemsReport(text: unknown): ParsedItem[] {
  if (!text) return [];
  return String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?):\s*([A-Z/]+|—|-)(?:\s*—\s*(.+))?$/i);
      if (!match) return { label: line, status: "—", note: "" };
      const label = match[1].trim();
      let status = match[2].trim().toUpperCase();
      if (!STATUS_RE.test(status)) status = "—"; // "—", "-", free text
      return { label, status: status === "—" ? "—" : status, note: match[3]?.trim() ?? "" };
    });
}

function statusRank(s: string): number {
  if (s === "DEFECT") return 3;
  if (s === "N/A") return 2;
  if (s === "OK") return 1;
  return 0; // "—" / not recorded
}

// Aggregate a group of parsed lines for one system — the "worst" recorded
// status wins (DEFECT > N/A > OK), matching the paper form's spirit.
function aggFor(parsed: ParsedItem[], labels: string[]): { status: string; notes: string[] } {
  let best: { status: string; notes: string[] } = { status: "", notes: [] };
  for (const line of parsed) {
    if (!labels.includes(line.label)) continue;
    if (statusRank(line.status) > statusRank(best.status)) {
      best = { status: line.status, notes: line.note ? [line.note] : [] };
    } else if (line.status === best.status && line.note && !best.notes.includes(line.note)) {
      best.notes = [...best.notes, line.note];
    }
  }
  return best;
}

function verdictOf(preStatus: string, postStatus: string): Verdict {
  const pre = statusRank(preStatus);
  const post = statusRank(postStatus);
  if (post === 0) return "UNRECORDED";
  if (pre === 0) return post >= 3 ? "NEW_DEFECT" : "N_A";
  if (preStatus === "DEFECT" && postStatus === "DEFECT") return "PERSISTENT";
  if (preStatus === "DEFECT" && postStatus === "OK") return "RESOLVED";
  if (preStatus === "OK" && postStatus === "DEFECT") return "NEW_DEFECT";
  if (preStatus === "N/A" || postStatus === "N/A") return "N_A";
  return "CLEAR";
}

export function comparePrePost(pre: InspectionRow, post: InspectionRow): CompareRow[] {
  const preParsed = parseItemsReport(pre.items_report);
  const postParsed = parseItemsReport(post.items_report);
  return SYSTEMS.map((sys) => {
    const preAgg = aggFor(preParsed, sys.pre);
    const postAgg = aggFor(postParsed, sys.post);
    return {
      system: sys.label,
      preLabels: sys.pre,
      postLabels: sys.post,
      preStatus: preAgg.status || "—",
      postStatus: postAgg.status || "—",
      notes: [...new Set([...preAgg.notes, ...postAgg.notes])],
      verdict: verdictOf(preAgg.status, postAgg.status),
    };
  });
}

const ANOMALY_VERDICTS: Verdict[] = ["NEW_DEFECT", "PERSISTENT"];

export function anomalyLabel(v: Verdict): string {
  switch (v) {
    case "NEW_DEFECT":
      return "New defect on return";
    case "PERSISTENT":
      return "Persistent defect";
    case "RESOLVED":
      return "Resolved on return";
    default:
      return "";
  }
}

export function analyzeInspections(rows: InspectionRow[]): Analysis {
  const idOf = (r: InspectionRow): number => Number(r.id) || 0;
  const pres = rows
    .filter((r) => !isPostRow(r))
    .sort((a, b) => rowStamp(a).localeCompare(rowStamp(b)));
  const posts = rows
    .filter((r) => isPostRow(r))
    .sort((a, b) => rowStamp(a).localeCompare(rowStamp(b)));
  const usedPosts = new Set<number>();
  const panels: Record<number, CompareRow[]> = {};
  const statusByRow: Record<number, InspStatus> = {};
  const matchByRow: Record<number, number> = {};

  for (const pre of pres) {
    const preId = idOf(pre);
    const vehicle = norm(pre.vehicle_no);
    if (!vehicle) continue; // can't pair without a vehicle id
    const stamp = rowStamp(pre);
    const post = posts.find(
      (p) => norm(p.vehicle_no) === vehicle && !usedPosts.has(idOf(p)) && rowStamp(p) >= stamp,
    );
    if (post) {
      const postId = idOf(post);
      usedPosts.add(postId);
      panels[preId] = comparePrePost(pre, post);
      const anomalies = panels[preId].filter((c) => ANOMALY_VERDICTS.includes(c.verdict)).length;
      statusByRow[preId] = { kind: "compared", anomalies };
      statusByRow[postId] = { kind: "compared", anomalies };
      matchByRow[preId] = postId;
      matchByRow[postId] = preId;
    } else {
      statusByRow[preId] = { kind: "open" };
    }
  }
  for (const post of posts) {
    if (!usedPosts.has(idOf(post))) statusByRow[idOf(post)] = { kind: "standalone" };
  }

  const compared = Object.keys(panels).length;
  const anomalies = Object.values(panels).reduce(
    (acc, rows) => acc + rows.filter((c) => ANOMALY_VERDICTS.includes(c.verdict)).length,
    0,
  );

  return {
    summary: {
      open: Object.values(statusByRow).filter((s) => s.kind === "open").length,
      compared,
      anomalies,
    },
    statusByRow,
    panels,
    matchByRow,
  };
}