import { requireLicense } from "@/lib/license";
import { requireUser } from "@/lib/auth";
import { getFinanceSnapshot } from "@/lib/finance";
import { listCategories } from "@/lib/bank-repo";
import { FinanceDashboard } from "@/components/FinanceDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  requireLicense();
  await requireUser();
  const [snapshot, categories] = await Promise.all([getFinanceSnapshot(), listCategories()]);
  return <FinanceDashboard snapshot={JSON.parse(JSON.stringify(snapshot))} categories={categories} />;
}
