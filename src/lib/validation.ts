import { z } from "zod";

export const investmentTypeValues = [
  "CDB",
  "LCI",
  "LCA",
  "LC",
  "TESOURO_SELIC",
  "TESOURO_PREFIXADO",
  "TESOURO_IPCA",
  "POUPANCA",
  "OUTRO",
] as const;

export const indexTypeValues = ["CDI", "SELIC", "IPCA", "PREFIXADO"] as const;

export const liquidityValues = ["DIARIA", "NO_VENCIMENTO"] as const;
export const currencyValues = ["BRL", "USD", "EUR"] as const;

export const investmentSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome"),
  institution: z.string().trim().min(1, "Informe a instituição"),
  type: z.enum(investmentTypeValues),
  currency: z.enum(currencyValues).default("BRL"),
  indexType: z.enum(indexTypeValues),
  rate: z.coerce.number().positive("Taxa deve ser maior que zero"),
  principal: z.coerce.number().positive("Valor investido deve ser maior que zero"),
  applicationDate: z.coerce.date(),
  maturityDate: z.coerce.date().nullable().optional(),
  liquidity: z.enum(liquidityValues).default("NO_VENCIMENTO"),
  fgcCovered: z.coerce.boolean().default(true),
  notes: z.string().trim().optional().nullable(),
});

export type InvestmentInput = z.infer<typeof investmentSchema>;

export const settingsSchema = z.object({
  cdiRate: z.coerce.number().positive(),
  selicRate: z.coerce.number().positive(),
  ipcaRate: z.coerce.number().min(0),
  usdToBrl: z.coerce.number().positive(),
  eurToBrl: z.coerce.number().positive(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export const bankAccountTypeValues = [
  "CORRENTE",
  "POUPANCA",
  "CARTAO_CREDITO",
  "CARTEIRA",
  "OUTRO",
] as const;

export const bankTransactionTypeValues = ["CREDITO", "DEBITO", "TRANSFERENCIA"] as const;

export const bankAccountSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da conta"),
  institution: z.string().trim().min(1, "Informe o banco ou instituição"),
  type: z.enum(bankAccountTypeValues),
  currency: z.enum(currencyValues).default("BRL"),
  initialBalance: z.coerce.number(),
  creditLimit: z.coerce.number().nullable().optional(),
  closingDay: z.coerce.number().int().min(1).max(31).nullable().optional(),
  dueDay: z.coerce.number().int().min(1).max(31).nullable().optional(),
});

export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const bankTransactionSchema = z
  .object({
    accountId: z.string().trim().min(1, "Informe a conta"),
    categoryId: z.string().trim().optional().nullable(),
    type: z.enum(bankTransactionTypeValues),
    amount: z.coerce.number().positive("O valor deve ser maior que zero"),
    date: z.coerce.date(),
    description: z.string().trim().min(1, "Informe a descrição"),
    notes: z.string().trim().optional().nullable(),
    tags: z.string().trim().optional().nullable(),
    counterpartAccountId: z.string().trim().optional().nullable(),
    installmentCount: z.coerce.number().int().min(1).max(48).optional(),
  })
  .refine((value) => value.type !== "TRANSFERENCIA" || Boolean(value.counterpartAccountId), {
    message: "Informe a conta de destino",
    path: ["counterpartAccountId"],
  });

export type BankTransactionFormInput = z.infer<typeof bankTransactionSchema>;

export const budgetSchema = z.object({
  categoryId: z.string().trim().min(1),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().positive(),
});

export const recurrenceSchema = z.object({
  accountId: z.string().trim().min(1),
  categoryId: z.string().trim().optional().nullable(),
  type: z.enum(["CREDITO", "DEBITO"]),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1),
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  tags: z.string().trim().optional().nullable(),
});

export const goalSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(["RESERVA", "OBJETIVO"]).default("OBJETIVO"),
  targetAmount: z.coerce.number().positive(),
  currentAmount: z.coerce.number().min(0).default(0),
  deadline: z.coerce.date().nullable().optional(),
});
