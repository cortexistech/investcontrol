import { requireLicense } from "@/lib/license";
import { requireUser } from "@/lib/auth";
import { getFinanceSnapshot } from "@/lib/finance";
import { listAccounts, listCategories } from "@/lib/bank-repo";
import { serializeBankAccount } from "@/lib/types";
import { PlanningBoard } from "@/components/PlanningBoard";

export const dynamic = "force-dynamic";

export default async function PlanejamentoPage() {
  requireLicense();
  await requireUser();
  const [snapshot, accounts, categories] = await Promise.all([getFinanceSnapshot(), listAccounts(), listCategories()]);
  return (
    <PlanningBoard
      snapshot={JSON.parse(JSON.stringify(snapshot))}
      accounts={accounts.map(serializeBankAccount)}
      categories={categories}
    />
  );
}
