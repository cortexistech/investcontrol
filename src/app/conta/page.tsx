import { requireLicense } from "@/lib/license";
import { requireUser } from "@/lib/auth";
import { listAccounts, listCategories, listTransactions, summarizeMonth } from "@/lib/bank-repo";
import { serializeBankAccount, serializeBankTransaction } from "@/lib/types";
import { BankHome } from "@/components/BankHome";

export const dynamic = "force-dynamic";

export default async function ContaPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; accountId?: string }>;
}) {
  requireLicense();
  await requireUser();
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const accountId = params.accountId || undefined;

  const [accounts, categories, transactions] = await Promise.all([
    listAccounts(),
    listCategories(),
    listTransactions({ year, month, accountId }),
  ]);

  return (
    <BankHome
      initialAccounts={accounts.map(serializeBankAccount)}
      initialTransactions={transactions.map(serializeBankTransaction)}
      initialSummary={summarizeMonth(transactions)}
      categories={categories}
      year={year}
      month={month}
      initialAccountId={accountId ?? ""}
    />
  );
}
