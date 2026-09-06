import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { encrypt, decryptMoney, decryptText } from "@/lib/crypto";
import type { BankAccount, BankTransaction, BankAccountType, BankTransactionType, Currency, ExpenseCategoryKind } from "@/generated/prisma/client";

/**
 * name, institution, initialBalance and creditLimit on BankAccount, and amount, description,
 * notes and tags on BankTransaction, hold AES-256-GCM ciphertext on disk (see src/lib/crypto.ts).
 * This module is the only place allowed to call `prisma.bankAccount.*` / `prisma.bankTransaction.*`
 * directly, so encryption stays centralized. Rows written before these fields were encrypted (or
 * restored from an older backup) decrypt via decryptMoney/decryptText's legacy fallback and are
 * transparently rewritten in place — a one-time self-heal applied the first time each row is read.
 */
function decryptAccountRow(row: BankAccount) {
  const name = decryptText(row.name);
  const institution = decryptText(row.institution);
  const initialBalance = decryptMoney(row.initialBalance);
  const creditLimit = row.creditLimit != null ? decryptMoney(row.creditLimit) : null;
  const rewrite: { name?: string; institution?: string; initialBalance?: string; creditLimit?: string } = {};
  if (name.rewrite) rewrite.name = name.rewrite;
  if (institution.rewrite) rewrite.institution = institution.rewrite;
  if (initialBalance.rewrite) rewrite.initialBalance = initialBalance.rewrite;
  if (creditLimit?.rewrite) rewrite.creditLimit = creditLimit.rewrite;
  return {
    row: { ...row, name: name.text, institution: institution.text, initialBalance: initialBalance.amount, creditLimit: creditLimit ? creditLimit.amount : null },
    rewrite: Object.keys(rewrite).length ? rewrite : null,
  };
}

function decryptTransactionRow(row: BankTransaction) {
  const amount = decryptMoney(row.amount);
  const description = decryptText(row.description);
  const notes = row.notes != null ? decryptText(row.notes) : null;
  const tags = row.tags != null ? decryptText(row.tags) : null;
  const rewrite: { amount?: string; description?: string; notes?: string; tags?: string } = {};
  if (amount.rewrite) rewrite.amount = amount.rewrite;
  if (description.rewrite) rewrite.description = description.rewrite;
  if (notes?.rewrite) rewrite.notes = notes.rewrite;
  if (tags?.rewrite) rewrite.tags = tags.rewrite;
  return {
    row: { ...row, amount: amount.amount, description: description.text, notes: notes ? notes.text : null, tags: tags ? tags.text : null },
    rewrite: Object.keys(rewrite).length ? rewrite : null,
  };
}

export async function healRows<T extends { id: string }>(
  decrypted: Array<{ row: T; rewrite: Record<string, string> | null }>,
  update: (id: string, data: Record<string, string>) => Promise<unknown>,
) {
  await Promise.all(
    decrypted
      .filter((item): item is { row: T; rewrite: Record<string, string> } => item.rewrite !== null)
      .map((item) => update(item.row.id, item.rewrite).catch(() => {})),
  );
}

export type AccountInput = {
  name: string;
  institution: string;
  type: BankAccountType;
  currency: Currency;
  initialBalance: number;
  creditLimit?: number | null;
  closingDay?: number | null;
  dueDay?: number | null;
};

export type TransactionInput = {
  accountId: string;
  categoryId?: string | null;
  type: BankTransactionType;
  amount: number;
  date: Date;
  description: string;
  notes?: string | null;
  tags?: string | null;
  counterpartAccountId?: string | null;
  installmentCount?: number | null;
};

export type BankAccountView = {
  id: string;
  name: string;
  institution: string;
  type: BankAccountType;
  currency: Currency;
  initialBalance: number;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
  balance: number;
  availableLimit: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BankTransactionView = {
  id: string;
  accountId: string;
  accountName: string;
  accountType: BankAccountType;
  categoryId: string | null;
  categoryName: string | null;
  categoryParentName: string | null;
  categoryColor: string | null;
  type: BankTransactionType;
  amount: number;
  signedAmount: number;
  date: Date;
  description: string;
  notes: string | null;
  tags: string[];
  isIncoming: boolean;
  transferGroupId: string | null;
  counterpartAccountId: string | null;
  counterpartAccountName: string | null;
  installmentGroupId: string | null;
  installmentIndex: number | null;
  installmentCount: number | null;
  createdAt: Date;
  updatedAt: Date;
};

const DEFAULT_SUBCATEGORIES: Record<string, string[]> = {
  Moradia: ["Aluguel", "Condomínio", "Internet", "Energia", "Água"],
  Alimentação: ["Restaurante", "Delivery", "Café"],
  Transporte: ["Combustível", "Aplicativo", "Transporte público"],
  Assinaturas: ["Streaming", "Software"],
  Saúde: ["Farmácia", "Consulta"],
};

const DEFAULT_CATEGORIES: Array<{ name: string; kind: ExpenseCategoryKind; color: string; sortOrder: number }> = [
  { name: "Salário", kind: "ENTRADA", color: "#16856f", sortOrder: 10 },
  { name: "Freelance", kind: "ENTRADA", color: "#0f766e", sortOrder: 20 },
  { name: "Rendimentos", kind: "ENTRADA", color: "#3d8b7a", sortOrder: 30 },
  { name: "Reembolso", kind: "ENTRADA", color: "#4a8f6e", sortOrder: 40 },
  { name: "Outros recebimentos", kind: "ENTRADA", color: "#5c7a7a", sortOrder: 50 },
  { name: "Alimentação", kind: "SAIDA", color: "#c2414d", sortOrder: 60 },
  { name: "Mercado", kind: "SAIDA", color: "#b4533c", sortOrder: 70 },
  { name: "Transporte", kind: "SAIDA", color: "#b7791f", sortOrder: 80 },
  { name: "Moradia", kind: "SAIDA", color: "#8c6d46", sortOrder: 90 },
  { name: "Contas e serviços", kind: "SAIDA", color: "#7a6c5d", sortOrder: 100 },
  { name: "Saúde", kind: "SAIDA", color: "#9c3d3d", sortOrder: 110 },
  { name: "Educação", kind: "SAIDA", color: "#4a5a6a", sortOrder: 120 },
  { name: "Lazer", kind: "SAIDA", color: "#6b8e5a", sortOrder: 130 },
  { name: "Assinaturas", kind: "SAIDA", color: "#5c7a7a", sortOrder: 140 },
  { name: "Compras", kind: "SAIDA", color: "#9c3d3d", sortOrder: 150 },
  { name: "Família", kind: "SAIDA", color: "#8a8478", sortOrder: 160 },
  { name: "Impostos", kind: "SAIDA", color: "#4a5a6a", sortOrder: 170 },
  { name: "Outros", kind: "SAIDA", color: "#b0a99c", sortOrder: 180 },
  { name: "Transferência", kind: "AMBOS", color: "#0f766e", sortOrder: 190 },
];

function newTransferGroupId() {
  return randomBytes(12).toString("hex");
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

function signedAmount(type: BankTransactionType, amount: number, isIncoming: boolean, accountType: BankAccountType) {
  const inflow = type === "CREDITO" || (type === "TRANSFERENCIA" && isIncoming);
  if (accountType === "CARTAO_CREDITO") {
    return inflow ? -amount : amount;
  }
  return inflow ? amount : -amount;
}

export function parseTags(value?: string | null) {
  if (!value?.trim()) return [];
  return [...new Set(value.split(/[#,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

export function serializeTags(value?: string | string[] | null) {
  const tags = Array.isArray(value) ? value : parseTags(value);
  return tags.length ? tags.join(",") : null;
}

function encryptTags(value?: string | string[] | null) {
  const serialized = serializeTags(value);
  return serialized ? encrypt(serialized) : null;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002";
}

/**
 * Seeds the default category taxonomy. Safe to call concurrently — e.g. getFinanceSnapshot()
 * calls this directly and, in the same Promise.all, also calls listCategories() (which calls
 * this too): both calls can race to see an empty table and both attempt to seed it, so every
 * write here tolerates losing that race (a unique constraint violation just means the other
 * call already did the job).
 */
export async function ensureDefaultCategories() {
  const count = await prisma.expenseCategory.count();
  if (count === 0) {
    try {
      await prisma.expenseCategory.createMany({
        data: DEFAULT_CATEGORIES.map((category) => ({ ...category, system: true })),
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }
  const parents = await prisma.expenseCategory.findMany({ where: { parentId: null } });
  const existing = new Set((await prisma.expenseCategory.findMany({ select: { name: true } })).map((item) => item.name));
  for (const parent of parents) {
    const children = DEFAULT_SUBCATEGORIES[parent.name] ?? [];
    for (const [index, name] of children.entries()) {
      if (existing.has(name)) continue;
      try {
        await prisma.expenseCategory.create({
          data: {
            name,
            kind: parent.kind,
            color: parent.color,
            sortOrder: parent.sortOrder + index + 1,
            system: true,
            parentId: parent.id,
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
      }
      existing.add(name);
    }
  }
}

export async function listCategories() {
  await ensureDefaultCategories();
  return prisma.expenseCategory.findMany({
    include: { parent: true, children: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function listAccounts(): Promise<BankAccountView[]> {
  const [accountRows, transactionRows] = await Promise.all([
    prisma.bankAccount.findMany(),
    prisma.bankTransaction.findMany({ select: { id: true, accountId: true, type: true, amount: true, isIncoming: true } }),
  ]);

  const decryptedAccounts = accountRows.map(decryptAccountRow);
  const decryptedAmounts = transactionRows.map((item) => ({ ...item, ...decryptMoney(item.amount) }));
  await Promise.all([
    healRows(decryptedAccounts, (id, data) => prisma.bankAccount.update({ where: { id }, data })),
    Promise.all(
      decryptedAmounts
        .filter((item) => item.rewrite)
        .map((item) => prisma.bankTransaction.update({ where: { id: item.id }, data: { amount: item.rewrite! } }).catch(() => {})),
    ),
  ]);

  const accounts = decryptedAccounts.map((item) => item.row).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

  return accounts.map((account) => {
    const balance = decryptedAmounts
      .filter((item) => item.accountId === account.id)
      .reduce(
        (total, item) => total + signedAmount(item.type, item.amount, item.isIncoming, account.type),
        account.initialBalance,
      );
    const availableLimit = account.type === "CARTAO_CREDITO" && account.creditLimit != null
      ? account.creditLimit - balance
      : null;
    return { ...account, balance, availableLimit };
  });
}

export async function getAccount(id: string) {
  const accounts = await listAccounts();
  return accounts.find((account) => account.id === id) ?? null;
}

function encryptAccountInput(data: AccountInput) {
  return {
    name: encrypt(data.name),
    institution: encrypt(data.institution),
    type: data.type,
    currency: data.currency,
    initialBalance: encrypt(String(data.initialBalance)),
    creditLimit: data.creditLimit != null ? encrypt(String(data.creditLimit)) : null,
    closingDay: data.closingDay ?? null,
    dueDay: data.dueDay ?? null,
  };
}

export async function createAccount(data: AccountInput): Promise<BankAccountView> {
  const account = await prisma.bankAccount.create({ data: encryptAccountInput(data) });
  const availableLimit = data.type === "CARTAO_CREDITO" && data.creditLimit != null ? data.creditLimit - data.initialBalance : null;
  return { ...decryptAccountRow(account).row, balance: data.initialBalance, availableLimit };
}

export async function updateAccount(id: string, data: AccountInput) {
  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing) return null;
  await prisma.bankAccount.update({ where: { id }, data: encryptAccountInput(data) });
  return getAccount(id);
}

export async function deleteAccount(id: string) {
  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.bankAccount.delete({ where: { id } });
  return true;
}

export async function listTransactions(filters: {
  year?: number;
  month?: number;
  accountId?: string;
  q?: string;
}): Promise<BankTransactionView[]> {
  const where: { date?: { gte: Date; lt: Date }; accountId?: string } = {};

  if (filters.year && filters.month) {
    const { start, end } = monthRange(filters.year, filters.month);
    where.date = { gte: start, lt: end };
  }
  if (filters.accountId) where.accountId = filters.accountId;

  const rows = await prisma.bankTransaction.findMany({
    where,
    include: {
      account: true,
      category: { include: { parent: true } },
      counterpartAccount: true,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const decrypted = rows.map((row) => ({ ...decryptTransactionRow(row), account: row.account, category: row.category, counterpartAccount: row.counterpartAccount }));
  await healRows(decrypted, (id, data) => prisma.bankTransaction.update({ where: { id }, data }));

  const views = decrypted.map(({ row, account, category, counterpartAccount }) => ({
    id: row.id,
    accountId: row.accountId,
    accountName: decryptText(account.name).text,
    accountType: account.type,
    categoryId: row.categoryId,
    categoryName: category?.name ?? null,
    categoryParentName: category?.parent?.name ?? null,
    categoryColor: category?.color ?? null,
    type: row.type,
    amount: row.amount,
    signedAmount: signedAmount(row.type, row.amount, row.isIncoming, account.type),
    date: row.date,
    description: row.description,
    notes: row.notes,
    tags: parseTags(row.tags),
    isIncoming: row.isIncoming,
    transferGroupId: row.transferGroupId,
    counterpartAccountId: row.counterpartAccountId,
    counterpartAccountName: counterpartAccount ? decryptText(counterpartAccount.name).text : null,
    installmentGroupId: row.installmentGroupId,
    installmentIndex: row.installmentIndex,
    installmentCount: row.installmentCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  if (!filters.q?.trim()) return views;
  const needle = filters.q.trim().toLowerCase();
  return views.filter((item) =>
    [item.description, item.categoryName, item.accountName, item.counterpartAccountName]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle)),
  );
}

export type InstallmentDue = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: BankTransactionType;
  source: "parcela";
  accountName: string;
  categoryName: string | null;
};

export async function listUpcomingInstallments(now: Date, days: number): Promise<InstallmentDue[]> {
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const rows = await prisma.bankTransaction.findMany({
    where: {
      installmentGroupId: { not: null },
      date: { gte: now, lte: end },
      type: "DEBITO",
    },
    include: { account: true, category: true },
    orderBy: { date: "asc" },
  });

  const decrypted = rows.map((row) => ({ ...decryptTransactionRow(row), account: row.account, category: row.category }));
  await healRows(decrypted, (id, data) => prisma.bankTransaction.update({ where: { id }, data }));

  return decrypted.map(({ row, account, category }) => ({
    id: row.id,
    date: row.date.toISOString(),
    description: row.description,
    amount: row.amount,
    type: row.type,
    source: "parcela" as const,
    accountName: decryptText(account.name).text,
    categoryName: category?.name ?? null,
  }));
}

export function summarizeMonth(transactions: BankTransactionView[]) {
  let income = 0;
  let expense = 0;
  for (const item of transactions) {
    if (item.type === "CREDITO") income += item.amount;
    if (item.type === "DEBITO") expense += item.amount;
  }
  return { income, expense, net: income - expense };
}

export async function createTransaction(data: TransactionInput) {
  if (data.type === "TRANSFERENCIA") {
    if (!data.counterpartAccountId) throw new Error("Informe a conta de destino.");
    if (data.counterpartAccountId === data.accountId) throw new Error("Escolha uma conta diferente para transferir.");
    const [source, destination] = await Promise.all([
      prisma.bankAccount.findUnique({ where: { id: data.accountId } }),
      prisma.bankAccount.findUnique({ where: { id: data.counterpartAccountId } }),
    ]);
    if (!source || !destination) throw new Error("Conta não encontrada.");

    const transferCategory = await prisma.expenseCategory.findUnique({ where: { name: "Transferência" } });
    const groupId = newTransferGroupId();
    const shared = {
      categoryId: data.categoryId ?? transferCategory?.id ?? null,
      type: "TRANSFERENCIA" as const,
      amount: encrypt(String(data.amount)),
      date: data.date,
      description: encrypt(data.description),
      notes: data.notes ? encrypt(data.notes) : null,
      tags: encryptTags(data.tags),
      transferGroupId: groupId,
    };

    await prisma.$transaction([
      prisma.bankTransaction.create({
        data: { ...shared, accountId: source.id, counterpartAccountId: destination.id, isIncoming: false },
      }),
      prisma.bankTransaction.create({
        data: { ...shared, accountId: destination.id, counterpartAccountId: source.id, isIncoming: true },
      }),
    ]);
    return;
  }

  const count = Math.max(1, Math.floor(data.installmentCount ?? 1));
  const tags = encryptTags(data.tags);
  const notes = data.notes ? encrypt(data.notes) : null;
  if (count === 1) {
    await prisma.bankTransaction.create({
      data: {
        accountId: data.accountId,
        categoryId: data.categoryId ?? null,
        type: data.type,
        amount: encrypt(String(data.amount)),
        date: data.date,
        description: encrypt(data.description),
        notes,
        tags,
        isIncoming: data.type === "CREDITO",
      },
    });
    return;
  }

  const groupId = newTransferGroupId();
  const base = Math.floor((data.amount / count) * 100) / 100;
  const amounts = Array.from({ length: count }, (_, index) => (index === count - 1 ? Number((data.amount - base * (count - 1)).toFixed(2)) : base));
  await prisma.$transaction(
    amounts.map((amount, index) =>
      prisma.bankTransaction.create({
        data: {
          accountId: data.accountId,
          categoryId: data.categoryId ?? null,
          type: data.type,
          amount: encrypt(String(amount)),
          date: new Date(Date.UTC(data.date.getUTCFullYear(), data.date.getUTCMonth() + index, data.date.getUTCDate())),
          description: encrypt(`${data.description} (${index + 1}/${count})`),
          notes,
          tags,
          isIncoming: data.type === "CREDITO",
          installmentGroupId: groupId,
          installmentIndex: index + 1,
          installmentCount: count,
        },
      }),
    ),
  );
}

export async function updateTransaction(id: string, data: TransactionInput) {
  const existing = await prisma.bankTransaction.findUnique({ where: { id } });
  if (!existing) return false;

  if (existing.transferGroupId) {
    await prisma.bankTransaction.deleteMany({ where: { transferGroupId: existing.transferGroupId } });
  } else if (existing.installmentGroupId) {
    await prisma.bankTransaction.deleteMany({ where: { installmentGroupId: existing.installmentGroupId } });
  } else {
    await prisma.bankTransaction.delete({ where: { id } });
  }
  await createTransaction(data);
  return true;
}

export async function deleteTransaction(id: string) {
  const existing = await prisma.bankTransaction.findUnique({ where: { id } });
  if (!existing) return false;
  if (existing.transferGroupId) {
    await prisma.bankTransaction.deleteMany({ where: { transferGroupId: existing.transferGroupId } });
  } else if (existing.installmentGroupId) {
    await prisma.bankTransaction.deleteMany({ where: { installmentGroupId: existing.installmentGroupId } });
  } else {
    await prisma.bankTransaction.delete({ where: { id } });
  }
  return true;
}

export function cashBalance(accounts: BankAccountView[]) {
  return accounts
    .filter((account) => account.type !== "CARTAO_CREDITO")
    .reduce((total, account) => total + account.balance, 0);
}

export function cardInvoices(accounts: BankAccountView[]) {
  return accounts
    .filter((account) => account.type === "CARTAO_CREDITO")
    .reduce((total, account) => total + account.balance, 0);
}
