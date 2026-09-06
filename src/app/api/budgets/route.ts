import { NextResponse } from "next/server";
import { deleteBudget, upsertBudget } from "@/lib/finance";
import { getLicenseOrNull, licenseErrorResponse } from "@/lib/license";
import { getAuthenticatedUserOrNull } from "@/lib/auth";
import { budgetSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = budgetSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await upsertBudget(parsed.data), { status: 201 });
}

export async function DELETE(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Informe o orçamento." }, { status: 400 });
  await deleteBudget(id);
  return NextResponse.json({ ok: true });
}
