import { prisma } from "@/lib/prisma";
import {
  cashBalance,
  cardInvoices,
  healRows,
  listAccounts,
  listCategories,
  listTransactions,
  listUpcomingInstallments,
  summarizeMonth,
  type BankAccountView,
  type BankTransactionView,
} from "@/lib/bank-repo";
import { encrypt, decryptMoney, decryptText } from "@/lib/crypto";
import { listInvestments } from "@/lib/investments-repo";
import { projectValue, toBRL, type RatesSettings } from "@/lib/investment-calc";
import type { BankTransactionType, GoalKind } from "@/generated/prisma/client";

const FIXED_CATEGORIES = new Set(["Moradia", "Contas e serviços", "Assinaturas", "Impostos"]);

/**
 * amount/description/tags on Recurrence, amount on Budget, and name/targetAmount/currentAmount on
 * Goal hold AES-256-GCM ciphertext (see src/lib/crypto.ts). This module is the only place allowed
 * to call `prisma.recurrence.*` / `prisma.budget.*` / `prisma.goal.*` directly. Rows written before
 * these fields were encrypted decrypt via decryptMoney/decryptText's legacy fallback and are
 * transparently rewritten in place — a one-time self-heal applied the first time each row is read.
 */
function decryptRecurrenceRow<T extends { amount: string; description: string; tags: string | null; account: { name: string } }>(row: T) {
  const amount = decryptMoney(row.amount);
  const description = decryptText(row.description);
  const tags = row.tags != null ? decryptText(row.tags) : null;
  const accountName = decryptText(row.account.name);
  const rewrite: { amount?: string; description?: string; tags?: string } = {};
  if (amount.rewrite) rewrite.amount = amount.rewrite;
  if (description.rewrite) rewrite.description = description.rewrite;
  if (tags?.rewrite) rewrite.tags = tags.rewrite;
  return {
    row: { ...row, amount: amount.amount, description: description.text, tags: tags ? tags.text : null, account: { ...row.account, name: accountName.text } },
    rewrite: Object.keys(rewrite).length ? rewrite : null,
  };
}

function decryptBudgetRow<T extends { amount: string }>(row: T) {
  const amount = decryptMoney(row.amount);
  return { row: { ...row, amount: amount.amount }, rewrite: amount.rewrite ? { amount: amount.rewrite } : null };
}

function decryptGoalRow<T extends { name: string; targetAmount: string; currentAmount: string }>(row: T) {
  const name = decryptText(row.name);
  const targetAmount = decryptMoney(row.targetAmount);
  const currentAmount = decryptMoney(row.currentAmount);
  const rewrite: { name?: string; targetAmount?: string; currentAmount?: string } = {};
  if (name.rewrite) rewrite.name = name.rewrite;
  if (targetAmount.rewrite) rewrite.targetAmount = targetAmount.rewrite;
  if (currentAmount.rewrite) rewrite.currentAmount = currentAmount.rewrite;
  return {
    row: { ...row, name: name.text, targetAmount: targetAmount.amount, currentAmount: currentAmount.amount },
    rewrite: Object.keys(rewrite).length ? rewrite : null,
  };
}

export type FinanceDue = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: BankTransactionType;
  source: "recorrencia" | "parcela";
  accountName: string;
  categoryName: string | null;
};

export type FinanceSnapshot = {
  year: number;
  month: number;
  cash: number;
  invoices: number;
  freeUntilMonthEnd: number;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  monthlyCost: number;
  reserve: number;
  reserveMonths: number;
  investmentsNet: number;
  cashFlow: { days: 30 | 60 | 90; balance: number }[];
  cards: Array<{
    id: string;
    name: string;
    invoice: number;
    limit: number | null;
    available: number | null;
    dueDay: number | null;
    usedPercent: number | null;
  }>;
  accounts: BankAccountView[];
  budgets: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    color: string;
    limit: number;
    spent: number;
  }>;
  dues: FinanceDue[];
  goals: Array<{
    id: string;
    name: string;
    kind: GoalKind;
    targetAmount: number;
    currentAmount: number;
    deadline: string | null;
  }>;
  moneyFlow: Array<{ type: string; label: string; value: number; color: string }>;
  recurrences: Array<{
    id: string;
    accountId: string;
    categoryId: string | null;
    type: BankTransactionType;
    amount: number;
    description: string;
    dayOfMonth: number;
    startDate: string;
    endDate: string | null;
    active: boolean;
    tags: string | null;
  }>;
};

function utcDate(year: number, month: number, day: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(day, last)));
}

function addMonths(date: Date, count: number) {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth() + 1 + count, date.getUTCDate());
}

function occurrenceInMonth(dayOfMonth: number, year: number, month: number, start: Date, end: Date | null) {
  const date = utcDate(year, month, dayOfMonth);
  if (date < start) return null;
  if (end && date > end) return null;
  return date;
}

export async function getFinanceSnapshot(now = new Date()): Promise<FinanceSnapshot> {
  // listCategories() below already calls ensureDefaultCategories() — no need to call it here too
  // (a redundant explicit call raced with it inside the same Promise.all and could 500 on a
  // brand-new database; ensureDefaultCategories() is now also safe if that ever happens again).
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const [accounts, categories, monthTx, recurrenceRows, budgetRowsRaw, goalRows, investments, settings] = await Promise.all([
    listAccounts(),
    listCategories(),
    listTransactions({ year, month }),
    prisma.recurrence.findMany({ where: { active: true }, include: { account: true, category: true } }),
    prisma.budget.findMany({ where: { year, month }, include: { category: true } }),
    prisma.goal.findMany({ orderBy: { createdAt: "asc" } }),
    listInvestments(),
    prisma.settings.findUnique({ where: { id: "singleton" } }).then((value) => value ?? prisma.settings.create({ data: { id: "singleton" } })),
  ]);

  const decryptedRecurrences = recurrenceRows.map(decryptRecurrenceRow);
  const decryptedBudgets = budgetRowsRaw.map(decryptBudgetRow);
  const decryptedGoalRows = goalRows.map(decryptGoalRow);
  await Promise.all([
    healRows(decryptedRecurrences, (id, data) => prisma.recurrence.update({ where: { id }, data })),
    healRows(decryptedBudgets, (id, data) => prisma.budget.update({ where: { id }, data })),
    healRows(decryptedGoalRows, (id, data) => prisma.goal.update({ where: { id }, data })),
  ]);
  const recurrences = decryptedRecurrences.map((item) => item.row);
  const budgets = decryptedBudgets.map((item) => item.row);
  const goals = decryptedGoalRows.map((item) => item.row);

  const summary = summarizeMonth(monthTx);
  const cash = cashBalance(accounts);
  const invoices = cardInvoices(accounts);
  const upcomingRecurring = upcomingFromRecurrences(recurrences, now, 90);
  const remainingMonthRecurring = upcomingRecurring.filter((item) => {
    const date = new Date(item.date);
    return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date >= now;
  });
  const remainingOut = remainingMonthRecurring.filter((item) => item.type === "DEBITO").reduce((total, item) => total + item.amount, 0);
  const remainingIn = remainingMonthRecurring.filter((item) => item.type === "CREDITO").reduce((total, item) => total + item.amount, 0);
  const freeUntilMonthEnd = cash + remainingIn - remainingOut;

  const spentByRoot = new Map<string, number>();
  for (const item of monthTx) {
    if (item.type !== "DEBITO") continue;
    const root = item.categoryParentName ?? item.categoryName ?? "Outros";
    spentByRoot.set(root, (spentByRoot.get(root) ?? 0) + item.amount);
  }

  const budgetRows = budgets.map((budget) => {
    const root = budget.category.parentId ? categories.find((item) => item.id === budget.category.parentId)?.name : budget.category.name;
    const spent = monthTx
      .filter((item) => item.type === "DEBITO" && (item.categoryId === budget.categoryId || item.categoryParentName === budget.category.name || item.categoryName === budget.category.name))
      .reduce((total, item) => total + item.amount, 0);
    return {
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: root ?? budget.category.name,
      color: budget.category.color,
      limit: budget.amount,
      spent,
    };
  });

  const dues = [
    ...upcomingFromRecurrences(recurrences, now, 7),
    ...(await listUpcomingInstallments(now, 7)),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const monthlyCost = summary.expense > 0 ? summary.expense : averageMonthlyExpense(monthTx);
  const reserve = accounts.filter((account) => account.type === "POUPANCA").reduce((total, account) => total + account.balance, 0)
    + goals.filter((goal) => goal.kind === "RESERVA").reduce((total, goal) => total + goal.currentAmount, 0);
  const reserveMonths = monthlyCost > 0 ? reserve / monthlyCost : 0;

  const rates: RatesSettings = settings;
  const investmentsNet = investments.reduce((total, investment) => total + toBRL(projectValue(investment, rates, now).netValue, investment.currency, rates), 0);

  const cashFlow = [30, 60, 90].map((days) => ({
    days: days as 30 | 60 | 90,
    balance: projectCash(cash, recurrences, now, days),
  }));

  let fixed = 0;
  let variable = 0;
  for (const item of monthTx) {
    if (item.type !== "DEBITO") continue;
    const root = item.categoryParentName ?? item.categoryName ?? "";
    if (FIXED_CATEGORIES.has(root)) fixed += item.amount;
    else variable += item.amount;
  }

  return {
    year,
    month,
    cash,
    invoices,
    freeUntilMonthEnd,
    income: summary.income,
    expense: summary.expense,
    net: summary.net,
    savingsRate: summary.income > 0 ? summary.net / summary.income : 0,
    monthlyCost,
    reserve,
    reserveMonths,
    investmentsNet,
    cashFlow,
    cards: accounts
      .filter((account) => account.type === "CARTAO_CREDITO")
      .map((account) => ({
        id: account.id,
        name: account.name,
        invoice: account.balance,
        limit: account.creditLimit,
        available: account.availableLimit,
        dueDay: account.dueDay,
        usedPercent: account.creditLimit ? Math.min(100, (account.balance / account.creditLimit) * 100) : null,
      })),
    accounts,
    budgets: budgetRows,
    dues,
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      kind: goal.kind,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      deadline: goal.deadline ? goal.deadline.toISOString() : null,
    })),
    moneyFlow: [
      { type: "income", label: "Receitas", value: summary.income, color: "#16856f" },
      { type: "fixed", label: "Fixos", value: fixed, color: "#8c6d46" },
      { type: "variable", label: "Variáveis", value: variable, color: "#c2414d" },
      { type: "saved", label: "Retido", value: Math.max(0, summary.net), color: "#0f766e" },
    ].filter((item) => item.value > 0),
    recurrences: recurrences.map((item) => ({
      id: item.id,
      accountId: item.accountId,
      categoryId: item.categoryId,
      type: item.type,
      amount: item.amount,
      description: item.description,
      dayOfMonth: item.dayOfMonth,
      startDate: item.startDate.toISOString(),
      endDate: item.endDate ? item.endDate.toISOString() : null,
      active: item.active,
      tags: item.tags,
    })),
  };
}

function averageMonthlyExpense(monthTx: BankTransactionView[]) {
  const expense = monthTx.filter((item) => item.type === "DEBITO").reduce((total, item) => total + item.amount, 0);
  return expense;
}

function upcomingFromRecurrences(
  recurrences: Array<{
    id: string;
    description: string;
    amount: number;
    type: BankTransactionType;
    dayOfMonth: number;
    startDate: Date;
    endDate: Date | null;
    account: { name: string };
    category: { name: string } | null;
  }>,
  now: Date,
  days: number,
): FinanceDue[] {
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const dues: FinanceDue[] = [];
  for (const item of recurrences) {
    for (let cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); cursor <= end; cursor = addMonths(cursor, 1)) {
      const date = occurrenceInMonth(item.dayOfMonth, cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, item.startDate, item.endDate);
      if (!date || date < now || date > end) continue;
      dues.push({
        id: `${item.id}-${date.toISOString().slice(0, 10)}`,
        date: date.toISOString(),
        description: item.description,
        amount: item.amount,
        type: item.type,
        source: "recorrencia",
        accountName: item.account.name,
        categoryName: item.category?.name ?? null,
      });
    }
  }
  return dues;
}

function projectCash(
  start: number,
  recurrences: Array<{ type: BankTransactionType; amount: number; dayOfMonth: number; startDate: Date; endDate: Date | null }>,
  now: Date,
  days: number,
) {
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  let balance = start;
  for (const item of recurrences) {
    for (let cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); cursor <= end; cursor = addMonths(cursor, 1)) {
      const date = occurrenceInMonth(item.dayOfMonth, cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, item.startDate, item.endDate);
      if (!date || date < now || date > end) continue;
      balance += item.type === "CREDITO" ? item.amount : item.type === "DEBITO" ? -item.amount : 0;
    }
  }
  return balance;
}

export async function upsertBudget(input: { categoryId: string; year: number; month: number; amount: number }) {
  const amount = encrypt(String(input.amount));
  return prisma.budget.upsert({
    where: { categoryId_year_month: { categoryId: input.categoryId, year: input.year, month: input.month } },
    update: { amount },
    create: { ...input, amount },
  });
}

export async function deleteBudget(id: string) {
  await prisma.budget.delete({ where: { id } });
}

export async function createRecurrence(input: {
  accountId: string;
  categoryId?: string | null;
  type: BankTransactionType;
  amount: number;
  description: string;
  dayOfMonth: number;
  startDate: Date;
  endDate?: Date | null;
  tags?: string | null;
}) {
  return prisma.recurrence.create({
    data: {
      ...input,
      amount: encrypt(String(input.amount)),
      description: encrypt(input.description),
      categoryId: input.categoryId ?? null,
      endDate: input.endDate ?? null,
      tags: input.tags ? encrypt(input.tags) : null,
    },
  });
}

export async function deleteRecurrence(id: string) {
  await prisma.recurrence.delete({ where: { id } });
}

export async function createGoal(input: { name: string; kind: GoalKind; targetAmount: number; currentAmount: number; deadline?: Date | null }) {
  return prisma.goal.create({
    data: {
      ...input,
      name: encrypt(input.name),
      targetAmount: encrypt(String(input.targetAmount)),
      currentAmount: encrypt(String(input.currentAmount)),
      deadline: input.deadline ?? null,
    },
  });
}

export async function updateGoal(id: string, input: { name: string; kind: GoalKind; targetAmount: number; currentAmount: number; deadline?: Date | null }) {
  return prisma.goal.update({
    where: { id },
    data: {
      ...input,
      name: encrypt(input.name),
      targetAmount: encrypt(String(input.targetAmount)),
      currentAmount: encrypt(String(input.currentAmount)),
      deadline: input.deadline ?? null,
    },
  });
}

export async function deleteGoal(id: string) {
  await prisma.goal.delete({ where: { id } });
}
