import { prisma } from "@/lib/prisma";
import { requireLicense } from "@/lib/license";
import { requireUser } from "@/lib/auth";
import { listPortfolioEntries } from "@/lib/portfolio-repo";
import { DashboardOverview } from "@/components/DashboardOverview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  requireLicense();
  await requireUser();
  const year = new Date().getFullYear();
  const [entries, settings] = await Promise.all([
    listPortfolioEntries(year),
    prisma.settings.findUnique({ where: { id: "singleton" } }).then((value) => value ?? prisma.settings.create({ data: { id: "singleton" } })),
  ]);
  return <DashboardOverview initialEntries={entries} initialYear={year} rates={{ usdToBrl: settings.usdToBrl, eurToBrl: settings.eurToBrl }} />;
}