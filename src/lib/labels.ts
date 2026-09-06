import type { BankAccountType, BankTransactionType, IndexType, InvestmentType, Liquidity } from "@/generated/prisma/client";

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  CDB: "CDB",
  LCI: "LCI",
  LCA: "LCA",
  LC: "LC",
  TESOURO_SELIC: "Tesouro Selic",
  TESOURO_PREFIXADO: "Tesouro Prefixado",
  TESOURO_IPCA: "Tesouro IPCA+",
  POUPANCA: "Poupança",
  OUTRO: "Outro",
};

export const INDEX_TYPE_LABELS: Record<IndexType, string> = {
  CDI: "% do CDI",
  SELIC: "% da Selic",
  IPCA: "IPCA +",
  PREFIXADO: "Prefixado",
};

export const LIQUIDITY_LABELS: Record<Liquidity, string> = {
  DIARIA: "Diária",
  NO_VENCIMENTO: "No vencimento",
};

export const TYPE_COLORS: Record<InvestmentType, string> = {
  CDB: "#d4af37",
  LCI: "#6b8e5a",
  LCA: "#8c6d46",
  LC: "#7a6c5d",
  TESOURO_SELIC: "#4a5a6a",
  TESOURO_PREFIXADO: "#9c3d3d",
  TESOURO_IPCA: "#5c7a7a",
  POUPANCA: "#8a8478",
  OUTRO: "#b0a99c",
};

export const DEFAULT_RATE_SUFFIX: Record<IndexType, string> = {
  CDI: "% CDI",
  SELIC: "% Selic",
  IPCA: "% a.a. (+IPCA)",
  PREFIXADO: "% a.a.",
};

export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  CORRENTE: "Conta corrente",
  POUPANCA: "Poupança",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTEIRA: "Carteira / dinheiro",
  OUTRO: "Outra",
};

export const BANK_TRANSACTION_TYPE_LABELS: Record<BankTransactionType, string> = {
  CREDITO: "Entrada",
  DEBITO: "Saída",
  TRANSFERENCIA: "Transferência",
};

export function formatRate(indexType: IndexType, rate: number): string {
  switch (indexType) {
    case "CDI":
      return `${rate}% do CDI`;
    case "SELIC":
      return `${rate}% da Selic`;
    case "IPCA":
      return `IPCA + ${rate}% a.a.`;
    case "PREFIXADO":
      return `${rate}% a.a.`;
  }
}
