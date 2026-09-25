import { parseContactPaste } from "@/lib/crm";

export type Recipient = { name: string | null; phone: string };

async function readSpreadsheet(file: File) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return workbook.SheetNames.map((sheetName) =>
    XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]!),
  ).join("\n");
}

async function readPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let page = 1; page <= doc.numPages; page += 1) {
    const content = await (await doc.getPage(page)).getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/(\+?\d[\d\s\-()]{7,17}\d)/g, "\n$1\n"),
    );
  }
  return pages.join("\n");
}

/** Extract phone/name pairs from a pasted list or an uploaded file. */
export async function extractRecipients(file: File): Promise<Recipient[]> {
  const name = file.name.toLowerCase();
  let text: string;
  if (/\.(xlsx|xls|xlsm|ods)$/.test(name)) {
    text = await readSpreadsheet(file);
  } else if (name.endsWith(".pdf")) {
    text = await readPdf(file);
  } else {
    text = await file.text();
  }
  return parseContactPaste(text);
}
