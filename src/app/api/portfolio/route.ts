import { NextResponse } from "next/server";
import { getLicenseOrNull, licenseErrorResponse } from "@/lib/license";
import { getAuthenticatedUserOrNull } from "@/lib/auth";
import { deletePortfolioEntries, listPortfolioEntries, renamePortfolioEntry, upsertPortfolioEntry } from "@/lib/portfolio-repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const year = Number(new URL(request.url).searchParams.get("year") ?? new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
  }
  const entries = await listPortfolioEntries(year);
  return NextResponse.json(entries);
}

export async function PUT(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json();
  const year = Number(body.year);
  const month = Number(body.month);
  const value = Number(body.value);
  const movementAmount = Number(body.movementAmount ?? 0);
  const movementType = body.movementType === "APORTE" || body.movementType === "RETIRADA" ? body.movementType : null;
  const currency = body.currency === "USD" || body.currency === "EUR" ? body.currency : "BRL";
  const institution = String(body.institution ?? "").trim();
  const category = String(body.category ?? "").trim();

  if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 0 || month > 12 || !institution || !category || !Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: "Informe ano, mês, instituição, categoria e um valor válido." }, { status: 400 });
  }
  if (!Number.isFinite(movementAmount) || movementAmount < 0) return NextResponse.json({ error: "Movimentação inválida." }, { status: 400 });

  const { entry, currencyMismatch } = await upsertPortfolioEntry({ year, month, institution, category, currency, value, movementType, movementAmount });
  if (currencyMismatch) {
    return NextResponse.json({ error: "A moeda de um lançamento existente não pode ser alterada neste campo. Use Alterar lançamento." }, { status: 409 });
  }
  return NextResponse.json(entry);
}

export async function DELETE(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json();
  const month = body.month === undefined ? undefined : Number(body.month);
  await deletePortfolioEntries({ year: Number(body.year), month, institution: String(body.institution ?? ""), category: String(body.category ?? "") });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json();
  const year = Number(body.year);
  const oldInstitution = String(body.oldInstitution ?? "").trim();
  const oldCategory = String(body.oldCategory ?? "").trim();
  const institution = String(body.institution ?? "").trim();
  const category = String(body.category ?? "").trim();
  const currency = body.currency === "USD" || body.currency === "EUR" ? body.currency : "BRL";
  if (!Number.isInteger(year) || !oldInstitution || !oldCategory || !institution || !category) {
    return NextResponse.json({ error: "Informe os dados do lançamento." }, { status: 400 });
  }
  try {
    const result = await renamePortfolioEntry({ year, oldInstitution, oldCategory, institution, category, currency });
    if (result.count === 0) return NextResponse.json({ error: "Lançamento não encontrado para este ano." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Já existe um lançamento com essa instituição, aplicação e mês." }, { status: 409 });
  }
}