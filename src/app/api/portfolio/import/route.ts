import { NextResponse } from "next/server";
import { getLicenseOrNull, licenseErrorResponse } from "@/lib/license";
import { getAuthenticatedUserOrNull } from "@/lib/auth";
import { importPortfolioEntries } from "@/lib/portfolio-repo";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const valueColumns = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25];
const ignoredLabels = new Set(["APLICAÇÃO", "APLICACAO", "PLANILHA DE GANHOS"]);

function text(value: unknown) {
  return String(value ?? "").trim();
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rowsForSheet(rows: unknown[][], year: number) {
  const imported: Array<{ year: number; month: number; institution: string; category: string; currency: "BRL"; value: number }> = [];
  let boundary = 0;

  function flush(institution: string, start: number, end: number) {
    for (const row of rows.slice(start, end)) {
      const category = text(row[0]);
      const normalized = category.toUpperCase();
      if (!category || ignoredLabels.has(normalized) || normalized.startsWith("TOTAL ")) continue;
      valueColumns.forEach((column, month) => {
        if (typeof row[column] === "number" && Number.isFinite(row[column])) {
          imported.push({ year, month, institution, category, currency: "BRL", value: number(row[column]) });
        }
      });
    }
  }

  for (let index = 0; index < rows.length; index += 1) {
    const label = text(rows[index]?.[0]);
    if (label.toUpperCase().startsWith("TOTAL ")) {
      flush(label.slice(6).trim() || "Importado", boundary, index);
      boundary = index + 1;
    }
  }
  if (boundary < rows.length) flush("Importado", boundary, rows.length);
  return imported;
}

export async function POST(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecione um arquivo Excel." }, { status: 400 });

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: false });
  const imported = workbook.SheetNames.flatMap((sheetName) => {
    const year = Number(sheetName);
    if (!Number.isInteger(year)) return [];
    return rowsForSheet(XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true }) as unknown[][], year);
  });

  await importPortfolioEntries(imported);
  return NextResponse.json({ imported: imported.length, years: workbook.SheetNames.filter((name) => /^\d{4}$/.test(name)) });
}