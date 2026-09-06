import { NextResponse } from "next/server";
import { createTransaction, listTransactions, summarizeMonth } from "@/lib/bank-repo";
import { getLicenseOrNull, licenseErrorResponse } from "@/lib/license";
import { getAuthenticatedUserOrNull } from "@/lib/auth";
import { serializeBankTransaction } from "@/lib/types";
import { bankTransactionSchema } from "@/lib/validation";

export async function GET(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year") || 0) || undefined;
  const month = Number(url.searchParams.get("month") || 0) || undefined;
  const accountId = url.searchParams.get("accountId") || undefined;
  const q = url.searchParams.get("q") || undefined;
  const transactions = await listTransactions({ year, month, accountId, q });
  return NextResponse.json({
    transactions: transactions.map(serializeBankTransaction),
    summary: summarizeMonth(transactions),
  });
}

export async function POST(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = bankTransactionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    await createTransaction(parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível registrar." }, { status: 400 });
  }
}
