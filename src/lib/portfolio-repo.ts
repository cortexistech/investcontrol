import { prisma } from "@/lib/prisma";
import { encrypt, decryptMoney } from "@/lib/crypto";
import { healRows } from "@/lib/bank-repo";
import type { PortfolioEntry, Currency } from "@/generated/prisma/client";

/**
 * value, contributions and withdrawals hold AES-256-GCM ciphertext on disk (see src/lib/crypto.ts).
 * This module is the only place allowed to call `prisma.portfolioEntry.*` directly, so encryption
 * stays centralized. institution/category/year/month stay plaintext — they're the compound natural
 * key this model is upserted/renamed/deleted by, which requires a value the database can compare
 * directly. Rows written before these fields were encrypted (or restored from an older backup)
 * decrypt via decryptMoney's legacy fallback and are transparently rewritten in place — a one-time
 * self-heal applied the first time each row is read.
 */
export type PortfolioEntryView = Omit<PortfolioEntry, "value" | "contributions" | "withdrawals"> & {
  value: number;
  contributions: number;
  withdrawals: number;
};

function decryptEntryRow(row: PortfolioEntry) {
  const value = decryptMoney(row.value);
  const contributions = decryptMoney(row.contributions);
  const withdrawals = decryptMoney(row.withdrawals);
  const rewrite: { value?: string; contributions?: string; withdrawals?: string } = {};
  if (value.rewrite) rewrite.value = value.rewrite;
  if (contributions.rewrite) rewrite.contributions = contributions.rewrite;
  if (withdrawals.rewrite) rewrite.withdrawals = withdrawals.rewrite;
  return {
    row: { ...row, value: value.amount, contributions: contributions.amount, withdrawals: withdrawals.amount },
    rewrite: Object.keys(rewrite).length ? rewrite : null,
  };
}

export async function listPortfolioEntries(year: number): Promise<PortfolioEntryView[]> {
  const rows = await prisma.portfolioEntry.findMany({ where: { year } });
  const decrypted = rows.map(decryptEntryRow);
  await healRows(decrypted, (id, data) => prisma.portfolioEntry.update({ where: { id }, data }));
  return decrypted
    .map((item) => item.row)
    .sort((a, b) => a.institution.localeCompare(b.institution) || a.category.localeCompare(b.category) || a.month - b.month);
}

export async function getPortfolioEntry(year: number, month: number, institution: string, category: string): Promise<PortfolioEntryView | null> {
  const row = await prisma.portfolioEntry.findUnique({ where: { year_month_institution_category: { year, month, institution, category } } });
  return row ? decryptEntryRow(row).row : null;
}

export async function upsertPortfolioEntry(input: {
  year: number;
  month: number;
  institution: string;
  category: string;
  currency: Currency;
  value: number;
  movementType?: "APORTE" | "RETIRADA" | null;
  movementAmount?: number;
}): Promise<{ entry: PortfolioEntryView; currencyMismatch: boolean }> {
  const key = { year: input.year, month: input.month, institution: input.institution, category: input.category };
  const existingRow = await prisma.portfolioEntry.findUnique({ where: { year_month_institution_category: key } });
  if (existingRow && existingRow.currency !== input.currency) {
    return { entry: decryptEntryRow(existingRow).row, currencyMismatch: true };
  }

  let contributions = existingRow ? decryptMoney(existingRow.contributions).amount : 0;
  let withdrawals = existingRow ? decryptMoney(existingRow.withdrawals).amount : 0;
  const movementAmount = input.movementAmount ?? 0;
  if (input.movementType === "APORTE") contributions += movementAmount;
  if (input.movementType === "RETIRADA") withdrawals += movementAmount;

  const data = {
    value: encrypt(String(input.value)),
    contributions: encrypt(String(contributions)),
    withdrawals: encrypt(String(withdrawals)),
  };
  const entry = await prisma.portfolioEntry.upsert({
    where: { year_month_institution_category: key },
    update: data,
    create: { ...key, currency: input.currency, ...data },
  });
  return { entry: decryptEntryRow(entry).row, currencyMismatch: false };
}

export async function importPortfolioEntries(
  entries: Array<{ year: number; month: number; institution: string; category: string; currency: Currency; value: number }>,
) {
  await prisma.$transaction(
    entries.map((entry) =>
      prisma.portfolioEntry.upsert({
        where: { year_month_institution_category: { year: entry.year, month: entry.month, institution: entry.institution, category: entry.category } },
        update: { value: encrypt(String(entry.value)) },
        create: {
          year: entry.year,
          month: entry.month,
          institution: entry.institution,
          category: entry.category,
          currency: entry.currency,
          value: encrypt(String(entry.value)),
          contributions: encrypt("0"),
          withdrawals: encrypt("0"),
        },
      }),
    ),
  );
}

export async function deletePortfolioEntries(where: { year: number; month?: number; institution: string; category: string }) {
  await prisma.portfolioEntry.deleteMany({ where });
}

export async function renamePortfolioEntry(input: { year: number; oldInstitution: string; oldCategory: string; institution: string; category: string; currency: Currency }) {
  return prisma.portfolioEntry.updateMany({
    where: { year: input.year, institution: input.oldInstitution, category: input.oldCategory },
    data: { institution: input.institution, category: input.category, currency: input.currency },
  });
}
