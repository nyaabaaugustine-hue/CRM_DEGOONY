"use client";

import type { EvidencePhoto } from "@/components/PhotoEvidence";
import type { ItemState } from "@/lib/items";
import { PRE_ITEMS, POST_ITEMS } from "@/lib/items";

const ITEM_LABELS: Record<string, string> = {};
for (const it of [...PRE_ITEMS, ...POST_ITEMS]) ITEM_LABELS[it.id] = it.label;

function buildInspectionText(
  formType: string,
  fields: Record<string, string>,
  items: Record<string, ItemState>,
  evidence: EvidencePhoto[],
): string {
  const lines: string[] = [];
  lines.push(`*${formType} — Evergreen Logistics*`);
  lines.push("");

  const summary: [string, string][] = [
    ["Date", fields.date],
    ["Driver", fields.driver],
    ["Vehicle", fields.vehicleNo],
  ];
  if (formType === "Pre-Trip Inspection") {
    summary.push(["Start time", fields.startTime]);
    summary.push(["Trailer", fields.trailerNo]);
    summary.push(["Odometer", fields.odometer]);
    summary.push(["Inspector", fields.inspector]);
    summary.push(["Vehicle type", fields.vehicleType]);
  } else {
    summary.push(["Return time", fields.returnTime]);
    summary.push(["End odometer", fields.endOdometer]);
    summary.push(["Battery", fields.batteryStatus]);
    summary.push(["Inspector", fields.inspector]);
  }

  for (const [label, val] of summary) {
    if (val) lines.push(`${label}: ${val}`);
  }

  const hasItems = Object.values(items).some(
    (it) => it.status || it.note || (it.photos && it.photos.length > 0),
  );
  if (hasItems) {
    lines.push("");
    lines.push("*Checklist*");
    for (const [id, it] of Object.entries(items)) {
      if (!it.status && !it.note) continue;
      const label = ITEM_LABELS[id] || id;
      lines.push(`• ${label}: ${it.status || "—"}`);
      if (it.note) lines.push(`  Note: ${it.note}`);
    }
  }

  if (formType === "Post-Trip Inspection") {
    if (fields.variance) {
      lines.push("");
      lines.push(`Variance: ${fields.variance}`);
      if (fields.varianceDetails) lines.push(`Details: ${fields.varianceDetails}`);
    }
    if (fields.disposition) lines.push(`Disposition: ${fields.disposition}`);
  }

  if (formType === "Pre-Trip Inspection") {
    if (fields.existingDamage) {
      lines.push("");
      lines.push(`Existing damage: ${fields.existingDamage}`);
    }
    if (fields.supervisorDecision) lines.push(`Supervisor decision: ${fields.supervisorDecision}`);
  }

  if (evidence.length > 0) {
    lines.push("");
    lines.push(`Photo evidence: ${evidence.length} photo(s)`);
    for (const ev of evidence) {
      if (ev.caption) lines.push(`  • ${ev.caption}`);
    }
  }

  return lines.join("\n");
}

function buildVehicleClientText(fields: Record<string, string>, evidence: EvidencePhoto[]): string {
  const lines: string[] = [];
  lines.push("*Vehicle Client Transaction — Evergreen Logistics*");
  lines.push("");

  const pairs: [string, string][] = [
    ["Client name", fields.clientName],
    ["Phone", fields.phoneNumber],
    ["Vehicle number", fields.vehicleNumber],
    ["Vehicle type", fields.vehicleType],
    ["Vehicle description", fields.vehicleDescription],
    ["Transaction date", fields.transactionDate],
    ["Transaction time", fields.transactionTime],
    ["Amount received (GHS)", fields.amountReceived],
    ["Receipt notes", fields.receiptNotes],
  ];

  for (const [label, val] of pairs) {
    if (val) lines.push(`${label}: ${val}`);
  }

  if (fields.googleDriveLinks) {
    lines.push("");
    lines.push("*Google Drive documents*");
    const links = fields.googleDriveLinks.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const l of links) lines.push(`• ${l}`);
  }

  if (evidence.length > 0) {
    lines.push("");
    lines.push(`Receipt photo: ${evidence.length} photo(s)`);
    for (const ev of evidence) {
      if (ev.caption) lines.push(`  • ${ev.caption}`);
    }
  }

  return lines.join("\n");
}

function buildDriverText(fields: Record<string, string>, evidence: EvidencePhoto[]): string {
  const lines: string[] = [];
  lines.push("*Driver Registration — Evergreen Logistics*");
  lines.push("");

  const pairs: [string, string][] = [
    ["Full name", fields.fullName],
    ["Phone", fields.phoneNumber],
    ["DOB", fields.dob],
    ["Ghana Card", fields.ghanaCardNo],
    ["Address", fields.residentialAddress],
    ["Emergency contact", fields.emergencyContact],
    ["Marital status", fields.maritalStatus],
    ["License no.", fields.licenseNumber],
    ["License class", fields.licenseClass],
    ["Valid license", fields.validLicense],
    ["Experience", fields.yearsExperience ? `${fields.yearsExperience} years` : ""],
    ["Previous employer", fields.previousEmployer],
    ["GPS directions", fields.gpsDirections],
    ["Sales targets", fields.salesTargets],
  ];

  for (const [label, val] of pairs) {
    if (val) lines.push(`${label}: ${val}`);
  }

  const hasGuarantors =
    fields.g1Name || fields.g1Phone || fields.g2Name || fields.g2Phone;
  if (hasGuarantors) {
    lines.push("");
    lines.push("*Guarantors*");
    if (fields.g1Name) {
      lines.push(`1. ${fields.g1Name}${fields.g1Relationship ? ` (${fields.g1Relationship})` : ""}`);
      if (fields.g1Phone) lines.push(`   Phone: ${fields.g1Phone}`);
      if (fields.g1Occupation) lines.push(`   Occupation: ${fields.g1Occupation}`);
    }
    if (fields.g2Name) {
      lines.push(`2. ${fields.g2Name}${fields.g2Relationship ? ` (${fields.g2Relationship})` : ""}`);
      if (fields.g2Phone) lines.push(`   Phone: ${fields.g2Phone}`);
      if (fields.g2Occupation) lines.push(`   Occupation: ${fields.g2Occupation}`);
    }
  }

  if (evidence.length > 0) {
    lines.push("");
    lines.push(`Attached: ${evidence.length} photo(s)`);
    for (const ev of evidence) {
      if (ev.caption) lines.push(`  • ${ev.caption}`);
    }
  }

  return lines.join("\n");
}

function buildEmailBody(
  formType: string,
  fields: Record<string, string>,
  items: Record<string, ItemState>,
  evidence: EvidencePhoto[],
): string {
  if (formType === "Driver Registration") return buildDriverText(fields, evidence);
  if (formType === "Vehicle Client Transaction") return buildVehicleClientText(fields, evidence);
  return buildInspectionText(formType, fields, items, evidence);
}

function buildEmailSubject(formType: string, fields: Record<string, string>): string {
  if (formType === "Driver Registration") {
    return `Driver Registration — ${fields.fullName || ""} — ${fields.phoneNumber || ""}`;
  }
  if (formType === "Vehicle Client Transaction") {
    return `Vehicle Client — ${fields.clientName || ""} — ${fields.vehicleNumber || ""}`;
  }
  const prefix = formType.includes("Pre") ? "PRE-TRIP" : "POST-TRIP";
  return `${prefix} — ${fields.vehicleNo || ""} — ${fields.driver || ""}`;
}

interface ShareButtonsProps {
  formType: string;
  fields: Record<string, string>;
  items: Record<string, ItemState>;
  evidence: EvidencePhoto[];
}

export default function ShareButtons({ formType, fields, items, evidence }: ShareButtonsProps) {
  const body = buildEmailBody(formType, fields, items, evidence);
  const whatsappText = body.replace(/\*/g, "");

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
  const emailSubject = buildEmailSubject(formType, fields);
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`;

  const openShare = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="share-buttons">
      <p className="share-label">Share this submission</p>
      <div className="share-row">
        <button className="btn-share btn-whatsapp" onClick={() => openShare(whatsappUrl)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          WhatsApp
        </button>
        <button className="btn-share btn-email" onClick={() => openShare(mailtoUrl)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
          Email
        </button>
      </div>
    </div>
  );
}
