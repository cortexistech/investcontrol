import { NextResponse } from "next/server";
import { deleteAccount, updateAccount } from "@/lib/bank-repo";
import { getLicenseOrNull, licenseErrorResponse } from "@/lib/license";
import { getAuthenticatedUserOrNull } from "@/lib/auth";
import { serializeBankAccount } from "@/lib/types";
import { bankAccountSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const parsed = bankAccountSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const account = await updateAccount(id, parsed.data);
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  return NextResponse.json(serializeBankAccount(account));
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const ok = await deleteAccount(id);
  if (!ok) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
