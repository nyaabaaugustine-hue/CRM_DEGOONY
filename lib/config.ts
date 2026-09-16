// Client-safe config. The Baserow token lives server-side only (lib/baserow.ts
// + /api routes); never expose it below.
// Table IDs created by the DEGOONY Evergreen Logistics database (Kuma).
export const INSPECTION_TABLE_ID = 1182655;
export const DRIVER_TABLE_ID = 1182656;
export const VEHICLE_CLIENT_TABLE_ID = 1196126;

// Simple staff access code for the internal tool. Change to any code you share
// with your team. Stored on the device after first entry (not a security boundary).
export const STAFF_CODE = "evergreen2026";
export const STAFF_CODE_KEY = "evergreen_staff_ok";