import { NextResponse } from "next/server";
import { deleteTransaction, updateTransaction } from "@/lib/bank-repo";
import { getLicenseOrNull, licenseErrorResponse } from "@/lib/license";
import { getAuthenticatedUserOrNull } from "@/lib/auth";
import { bankTransactionSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const parsed = bankTransactionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const ok = await updateTransaction(id, parsed.data);
    if (!ok) return NextResponse.json({ error: "Movimentação não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const ok = await deleteTransaction(id);
  if (!ok) return NextResponse.json({ error: "Movimentação não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
