import type { ExpenseCategory, Settings } from "@/generated/prisma/client";
import type { BankAccountView, BankTransactionView } from "@/lib/bank-repo";
import type { Investment } from "@/lib/investments-repo";

export type InvestmentDTO = Omit<Investment, "applicationDate" | "maturityDate" | "createdAt" | "updatedAt"> & {
  applicationDate: string;
  maturityDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SettingsDTO = Omit<Settings, "updatedAt"> & { updatedAt: string };

export type BankAccountDTO = Omit<BankAccountView, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type BankTransactionDTO = Omit<BankTransactionView, "date" | "createdAt" | "updatedAt"> & {
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseCategoryDTO = ExpenseCategory & {
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
};

export function serializeBankAccount(account: BankAccountView): BankAccountDTO {
  return {
    ...account,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function serializeBankTransaction(transaction: BankTransactionView): BankTransactionDTO {
  return {
    ...transaction,
    date: transaction.date.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

export function serializeInvestment(investment: Investment): InvestmentDTO {
  return {
    ...investment,
    applicationDate: investment.applicationDate.toISOString(),
    maturityDate: investment.maturityDate ? investment.maturityDate.toISOString() : null,
    createdAt: investment.createdAt.toISOString(),
    updatedAt: investment.updatedAt.toISOString(),
  };
}
