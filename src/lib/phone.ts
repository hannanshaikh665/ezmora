/** Shared phone validation used by both the Blast UI and the sending engine. */

const DEFAULT_COUNTRY_CODE = "91";

export type PhoneCheck =
  | { ok: true; e164: string }
  | { ok: false; reason: string };

/**
 * Normalises a raw phone string to E.164 digits (no `+`).
 * 10-digit Indian mobile numbers get the default country code.
 */
export function toE164(raw: string): PhoneCheck {
  const trimmed = (raw ?? "").toString().trim();
  if (!trimmed) return { ok: false, reason: "Empty number" };

  let digits = trimmed.replace(/[^\d]/g, "");
  if (trimmed.startsWith("00")) digits = digits.replace(/^00/, "");
  digits = digits.replace(/^0+/, "");

  if (digits.length === 10) digits = `${DEFAULT_COUNTRY_CODE}${digits}`;

  if (digits.length < 10 || digits.length > 15) {
    return { ok: false, reason: "Not a valid phone number length" };
  }
  if (/^(\d)\1+$/.test(digits)) {
    return { ok: false, reason: "Looks like a placeholder number" };
  }
  if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length === 12) {
    const local = digits.slice(2);
    if (!/^[6-9]\d{9}$/.test(local)) {
      return { ok: false, reason: "Not a valid Indian mobile number" };
    }
  }
  return { ok: true, e164: digits };
}

export type CleanRecipients = {
  valid: { name: string | null; phone: string }[];
  invalid: { phone: string; reason: string }[];
  duplicates: number;
};

/** Validates, de-duplicates and reports bad numbers for a recipient list. */
export function cleanRecipients(
  rows: { name?: string | null; phone?: string | null }[],
): CleanRecipients {
  const valid: { name: string | null; phone: string }[] = [];
  const invalid: { phone: string; reason: string }[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const row of rows) {
    const raw = (row?.phone ?? "").toString();
    const check = toE164(raw);
    if (!check.ok) {
      invalid.push({ phone: raw || "(blank)", reason: check.reason });
      continue;
    }
    if (seen.has(check.e164)) {
      duplicates += 1;
      continue;
    }
    seen.add(check.e164);
    valid.push({ name: row?.name ?? null, phone: check.e164 });
  }

  return { valid, invalid, duplicates };
}

const MEDIA_TYPES: Record<string, "image" | "video" | "document" | "audio"> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  mp4: "video",
  mov: "video",
  m4v: "video",
  "3gp": "video",
  pdf: "document",
  doc: "document",
  docx: "document",
  xls: "document",
  xlsx: "document",
  ppt: "document",
  pptx: "document",
  mp3: "audio",
  ogg: "audio",
  m4a: "audio",
};

/** Detects the WhatsApp media kind for an attachment URL, or null when unsupported. */
export function mediaKind(url: string): "image" | "video" | "document" | "audio" | null {
  if (!/^https?:\/\//i.test(url)) return null;
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const ext = pathname.split(".").pop()?.toLowerCase() ?? "";
  return MEDIA_TYPES[ext] ?? null;
}