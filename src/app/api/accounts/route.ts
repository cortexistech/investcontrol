import { NextResponse } from "next/server";
import { createAccount, listAccounts } from "@/lib/bank-repo";
import { getLicenseOrNull, licenseErrorResponse } from "@/lib/license";
import { getAuthenticatedUserOrNull } from "@/lib/auth";
import { serializeBankAccount } from "@/lib/types";
import { bankAccountSchema } from "@/lib/validation";

export async function GET() {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const accounts = await listAccounts();
  return NextResponse.json(accounts.map(serializeBankAccount));
}

export async function POST(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = bankAccountSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const account = await createAccount(parsed.data);
  return NextResponse.json(serializeBankAccount(account), { status: 201 });
}
