import { prisma } from "@/lib/prisma";

export const BACKUP_FORMAT = "investe-valor-backup-v1";

type BackupData = {
  settings: Awaited<ReturnType<typeof prisma.settings.findUnique>>;
  investments: Array<Record<string, unknown>>;
  investmentMovements: Array<Record<string, unknown>>;
  portfolioEntries: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  bankAccounts: Array<Record<string, unknown>>;
  expenseCategories: Array<Record<string, unknown>>;
  bankTransactions: Array<Record<string, unknown>>;
  recurrences: Array<Record<string, unknown>>;
  budgets: Array<Record<string, unknown>>;
  goals: Array<Record<string, unknown>>;
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  data: BackupData;
};

function date(value: unknown, field: string) {
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error(`Data inválida no campo ${field}.`);
  return parsed;
}

function records(value: unknown, field: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error(`Formato inválido no campo ${field}.`);
  }
  return value as Array<Record<string, unknown>>;
}

export async function exportBackup(): Promise<BackupFile> {
  const [settings, investments, investmentMovements, portfolioEntries, users, bankAccounts, expenseCategories, bankTransactions, recurrences, budgets, goals] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.investment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.investmentMovement.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.portfolioEntry.findMany({ orderBy: [{ year: "asc" }, { month: "asc" }] }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.bankAccount.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.bankTransaction.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.recurrence.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.budget.findMany({ orderBy: [{ year: "asc" }, { month: "asc" }] }),
    prisma.goal.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return {
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    data: { settings, investments, investmentMovements, portfolioEntries, users, bankAccounts, expenseCategories, bankTransactions, recurrences, budgets, goals },
  } as BackupFile;
}

export async function restoreBackup(input: unknown) {
  if (!input || typeof input !== "object" || (input as { format?: unknown }).format !== BACKUP_FORMAT) {
    throw new Error("Arquivo de backup inválido ou incompatível.");
  }
  const data = (input as { data?: unknown }).data;
  if (!data || typeof data !== "object") throw new Error("O backup não contém dados válidos.");
  const source = data as Record<string, unknown>;
  const settings = source.settings;
  const investments = records(source.investments, "investments");
  const investmentMovements = records(source.investmentMovements, "investmentMovements");
  const portfolioEntries = records(source.portfolioEntries, "portfolioEntries");
  const users = records(source.users, "users");
  const bankAccounts = source.bankAccounts == null ? [] : records(source.bankAccounts, "bankAccounts");
  const expenseCategories = source.expenseCategories == null ? [] : records(source.expenseCategories, "expenseCategories");
  const bankTransactions = source.bankTransactions == null ? [] : records(source.bankTransactions, "bankTransactions");
  const recurrences = source.recurrences == null ? [] : records(source.recurrences, "recurrences");
  const budgets = source.budgets == null ? [] : records(source.budgets, "budgets");
  const goals = source.goals == null ? [] : records(source.goals, "goals");

  await prisma.$transaction(async (tx) => {
    await tx.authSession.deleteMany();
    await tx.passwordResetToken.deleteMany();
    await tx.bankTransaction.deleteMany();
    await tx.recurrence.deleteMany();
    await tx.budget.deleteMany();
    await tx.goal.deleteMany();
    await tx.bankAccount.deleteMany();
    await tx.expenseCategory.deleteMany();
    await tx.investmentMovement.deleteMany();
    await tx.investment.deleteMany();
    await tx.portfolioEntry.deleteMany();
    await tx.settings.deleteMany();
    await tx.user.deleteMany();

    if (settings) {
      const item = settings as Record<string, unknown>;
      await tx.settings.create({
        data: {
          id: String(item.id ?? "singleton"),
          cdiRate: Number(item.cdiRate),
          selicRate: Number(item.selicRate),
          ipcaRate: Number(item.ipcaRate),
          usdToBrl: Number(item.usdToBrl),
          eurToBrl: Number(item.eurToBrl),
          updatedAt: date(item.updatedAt, "settings.updatedAt"),
        },
      });
    }

    for (const item of users) {
      await tx.user.create({ data: {
        id: String(item.id), email: String(item.email), passwordHash: String(item.passwordHash),
        totpSecret: item.totpSecret == null ? null : String(item.totpSecret), totpEnabled: Boolean(item.totpEnabled),
        createdAt: date(item.createdAt, "users.createdAt"), updatedAt: date(item.updatedAt, "users.updatedAt"),
      } });
    }

    // value, contributions, withdrawals below (and initialBalance, creditLimit, amount,
    // targetAmount, currentAmount further down) are stored as AES-256-GCM ciphertext (see
    // src/lib/crypto.ts) — passed through as-is via String(), never coerced with Number(), or the
    // ciphertext would be destroyed. A backup taken before these fields were encrypted still
    // round-trips safely: the plaintext number becomes a plaintext string, and the repo layer's
    // legacy fallback re-encrypts it the first time the row is read.
    for (const item of portfolioEntries) {
      await tx.portfolioEntry.create({ data: {
        id: String(item.id), year: Number(item.year), month: Number(item.month), institution: String(item.institution), category: String(item.category),
        currency: item.currency as "BRL" | "USD" | "EUR", value: String(item.value), contributions: String(item.contributions), withdrawals: String(item.withdrawals),
        createdAt: date(item.createdAt, "portfolioEntries.createdAt"), updatedAt: date(item.updatedAt, "portfolioEntries.updatedAt"),
      } });
    }

    for (const item of investments) {
      await tx.investment.create({ data: {
        id: String(item.id), name: String(item.name), institution: String(item.institution), type: item.type as never, currency: item.currency as never,
        indexType: item.indexType as never, rate: String(item.rate), principal: String(item.principal), applicationDate: date(item.applicationDate, "investments.applicationDate"),
        maturityDate: item.maturityDate == null ? null : date(item.maturityDate, "investments.maturityDate"), liquidity: item.liquidity as never,
        fgcCovered: Boolean(item.fgcCovered), notes: item.notes == null ? null : String(item.notes), createdAt: date(item.createdAt, "investments.createdAt"), updatedAt: date(item.updatedAt, "investments.updatedAt"),
      } });
    }

    for (const item of investmentMovements) {
      await tx.investmentMovement.create({ data: {
        id: String(item.id), investmentId: String(item.investmentId), type: item.type as never, amount: String(item.amount), date: date(item.date, "investmentMovements.date"),
        notes: item.notes == null ? null : String(item.notes), createdAt: date(item.createdAt, "investmentMovements.createdAt"),
      } });
    }

    for (const item of [...expenseCategories].sort((a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)))) {
      await tx.expenseCategory.create({ data: {
        id: String(item.id), name: String(item.name), kind: item.kind as never, color: String(item.color ?? "#0f766e"),
        sortOrder: Number(item.sortOrder ?? 0), system: Boolean(item.system),
        parentId: item.parentId == null ? null : String(item.parentId),
      } });
    }

    for (const item of bankAccounts) {
      await tx.bankAccount.create({ data: {
        id: String(item.id), name: String(item.name), institution: String(item.institution), type: item.type as never,
        currency: item.currency as never, initialBalance: String(item.initialBalance ?? 0),
        creditLimit: item.creditLimit == null ? null : String(item.creditLimit),
        closingDay: item.closingDay == null ? null : Number(item.closingDay),
        dueDay: item.dueDay == null ? null : Number(item.dueDay),
        createdAt: date(item.createdAt, "bankAccounts.createdAt"), updatedAt: date(item.updatedAt, "bankAccounts.updatedAt"),
      } });
    }

    for (const item of recurrences) {
      await tx.recurrence.create({ data: {
        id: String(item.id), accountId: String(item.accountId), categoryId: item.categoryId == null ? null : String(item.categoryId),
        type: item.type as never, amount: String(item.amount), description: String(item.description), dayOfMonth: Number(item.dayOfMonth),
        startDate: date(item.startDate, "recurrences.startDate"), endDate: item.endDate == null ? null : date(item.endDate, "recurrences.endDate"),
        active: item.active == null ? true : Boolean(item.active), tags: item.tags == null ? null : String(item.tags),
        createdAt: date(item.createdAt, "recurrences.createdAt"), updatedAt: date(item.updatedAt, "recurrences.updatedAt"),
      } });
    }

    for (const item of bankTransactions) {
      await tx.bankTransaction.create({ data: {
        id: String(item.id), accountId: String(item.accountId), categoryId: item.categoryId == null ? null : String(item.categoryId),
        type: item.type as never, amount: String(item.amount), date: date(item.date, "bankTransactions.date"),
        description: String(item.description), notes: item.notes == null ? null : String(item.notes),
        tags: item.tags == null ? null : String(item.tags),
        isIncoming: Boolean(item.isIncoming), transferGroupId: item.transferGroupId == null ? null : String(item.transferGroupId),
        counterpartAccountId: item.counterpartAccountId == null ? null : String(item.counterpartAccountId),
        installmentGroupId: item.installmentGroupId == null ? null : String(item.installmentGroupId),
        installmentIndex: item.installmentIndex == null ? null : Number(item.installmentIndex),
        installmentCount: item.installmentCount == null ? null : Number(item.installmentCount),
        recurrenceId: item.recurrenceId == null ? null : String(item.recurrenceId),
        createdAt: date(item.createdAt, "bankTransactions.createdAt"), updatedAt: date(item.updatedAt, "bankTransactions.updatedAt"),
      } });
    }

    for (const item of budgets) {
      await tx.budget.create({ data: {
        id: String(item.id), categoryId: String(item.categoryId), year: Number(item.year), month: Number(item.month), amount: String(item.amount),
        createdAt: date(item.createdAt, "budgets.createdAt"), updatedAt: date(item.updatedAt, "budgets.updatedAt"),
      } });
    }

    for (const item of goals) {
      await tx.goal.create({ data: {
        id: String(item.id), name: String(item.name), kind: item.kind as never, targetAmount: String(item.targetAmount),
        currentAmount: String(item.currentAmount ?? 0), deadline: item.deadline == null ? null : date(item.deadline, "goals.deadline"),
        createdAt: date(item.createdAt, "goals.createdAt"), updatedAt: date(item.updatedAt, "goals.updatedAt"),
      } });
    }
  });
}
