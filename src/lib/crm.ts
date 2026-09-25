export const LOOKING_FOR = [
  "Residential",
  "Commercial",
  "Shops",
  "Rent",
  "Office",
] as const;

export const CONFIGURATIONS = [
  "1 RK",
  "1 BHK",
  "1.5 BHK",
  "2 BHK",
  "2.5 BHK",
  "3 BHK",
  "3.5 BHK",
  "4 BHK",
  "Jodi",
] as const;

export const BUDGETS = [
  "40 - 60 Lakhs",
  "60 Lakhs - 1 Cr",
  "1 - 2 Cr",
  "2 - 4 Cr",
  "4 - 6 Cr",
  "6 - 10 Cr",
  "10 Cr +",
] as const;

export const LOCALITIES = [
  "Andheri",
  "Vile Parle",
  "Santa Cruz",
  "Khar Road",
  "Bandra",
  "Mahim",
  "Matunga",
  "Dadar",
  "Jogeshwari",
  "Ram Mandir",
  "Goregaon",
  "Malad",
  "Kandivali",
  "Borivali",
  "Dahisar",
  "Mira Road",
  "Bhayandar",
  "Naigaon",
  "Vasai Road",
  "Nala Sopara",
  "Virar",
  "Prabhadevi",
  "Lower Parel",
  "Mahalaxmi",
  "Mumbai Central",
  "Grant Road",
  "Girgaon",
  "Mumbai",
  "Churchgate",
] as const;

export const DATA_TYPES = [
  "Cold Data",
  "Leads",
  "Follow-up",
  "Existing Clients",
  "Referral",
  "Builders Database",
] as const;

export const TEMPERATURES = ["cold", "warm", "hot"] as const;

export const LEAD_STAGES = [
  "new",
  "qualified",
  "site visit",
  "negotiation",
  "booked",
  "lost",
] as const;

export const TASK_TYPES = [
  "note",
  "follow up",
  "call",
  "paper work",
  "site visit",
] as const;

export type AppRole = "owner" | "supervisor" | "employee";

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function normalizePhone(raw: string) {
  return raw.replace(/[^\d+]/g, "");
}

/** Pull phone/name pairs out of pasted text, CSV or spreadsheet exports. */
export function parseContactPaste(text: string) {
  const rows: { name: string | null; phone: string }[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const phoneMatch = line.match(/(\+?\d[\d\s\-()]{7,17}\d)/);
    if (!phoneMatch) continue;
    const phone = normalizePhone(phoneMatch[1]!);
    if (phone.replace(/\D/g, "").length < 8) continue;
    if (seen.has(phone)) continue;
    seen.add(phone);
    const name =
      line
        .replace(phoneMatch[1]!, " ")
        .split(/[,;\t|]/)
        .map((part) => part.trim())
        .find((part) => /[A-Za-z]{2,}/.test(part)) ?? null;
    rows.push({ name: name && name.length <= 80 ? name : null, phone });
  }
  return rows;
}