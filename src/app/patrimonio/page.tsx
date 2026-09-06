import { requireLicense } from "@/lib/license";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPortfolioEntries } from "@/lib/portfolio-repo";
import { PortfolioManager } from "@/components/PortfolioManager";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  requireLicense();
  await requireUser();
  const year = new Date().getFullYear();
  const [entries, settings] = await Promise.all([
    listPortfolioEntries(year),
    prisma.settings.findUnique({ where: { id: "singleton" } }).then((value) => value ?? prisma.settings.create({ data: { id: "singleton" } })),
  ]);
  return <PortfolioManager initialEntries={entries} initialYear={year} rates={{ usdToBrl: settings.usdToBrl, eurToBrl: settings.eurToBrl }} />;
}