"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, isSameDay, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { AccountForm } from "@/components/AccountForm";
import { TransactionForm } from "@/components/TransactionForm";
import { formatCurrency } from "@/lib/investment-calc";
import { BANK_ACCOUNT_TYPE_LABELS, BANK_TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import type { BankAccountDTO, BankTransactionDTO, ExpenseCategoryDTO } from "@/lib/types";

type MonthSummary = { income: number; expense: number; net: number };

function dayLabel(iso: string) {
  const date = parseISO(iso);
  if (isSameDay(date, new Date())) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd 'de' MMMM", { locale: ptBR });
}

function accountTone(type: BankAccountDTO["type"]) {
  if (type === "CARTAO_CREDITO") return "from-[#2a1a1c] to-[#4a2428] text-[#f6e6e4]";
  if (type === "POUPANCA") return "from-[#16332c] to-[#1f4a40] text-[#e7f4ef]";
  if (type === "CARTEIRA") return "from-[#2b2618] to-[#4a3f28] text-[#f4eedc]";
  return "from-[#102826] to-[#18423d] text-[#e8f6f3]";
}

export function BankHome({
  initialAccounts,
  initialTransactions,
  initialSummary,
  categories,
  year,
  month,
  initialAccountId = "",
}: {
  initialAccounts: BankAccountDTO[];
  initialTransactions: BankTransactionDTO[];
  initialSummary: MonthSummary;
  categories: ExpenseCategoryDTO[];
  year: number;
  month: number;
  initialAccountId?: string;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(initialAccountId);
  const [query, setQuery] = useState("");
  const [accountForm, setAccountForm] = useState<BankAccountDTO | null | "new">(null);
  const [transactionForm, setTransactionForm] = useState<BankTransactionDTO | null | "new">(null);
  const [deletingTx, setDeletingTx] = useState<BankTransactionDTO | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<BankAccountDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedAccount = initialAccounts.find((account) => account.id === accountId) ?? null;
  const cash = initialAccounts.filter((account) => account.type !== "CARTAO_CREDITO").reduce((total, account) => total + account.balance, 0);
  const invoices = initialAccounts.filter((account) => account.type === "CARTAO_CREDITO").reduce((total, account) => total + account.balance, 0);

  const visibleTransactions = useMemo(() => {
    const filtered = accountId
      ? initialTransactions
      : initialTransactions.filter((item) => item.type !== "TRANSFERENCIA" || !item.isIncoming);
    if (!query.trim()) return filtered;
    const needle = query.trim().toLowerCase();
    return filtered.filter((item) =>
      [item.description, item.categoryName, item.accountName, item.counterpartAccountName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle)),
    );
  }, [accountId, initialTransactions, query]);

  const groups = useMemo(() => {
    const map = new Map<string, BankTransactionDTO[]>();
    for (const item of visibleTransactions) {
      const key = item.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [visibleTransactions]);

  function changeMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    const params = new URLSearchParams({ year: String(next.getFullYear()), month: String(next.getMonth() + 1) });
    if (accountId) params.set("accountId", accountId);
    router.push(`/conta?${params.toString()}`);
  }

  function changeAccount(nextId: string) {
    setAccountId(nextId);
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (nextId) params.set("accountId", nextId);
    router.push(`/conta?${params.toString()}`);
  }

  async function confirmDeleteTransaction() {
    if (!deletingTx) return;
    const response = await fetch(`/api/transactions/${deletingTx.id}`, { method: "DELETE" });
    if (!response.ok) {
      setActionError("Não foi possível excluir a movimentação.");
      return;
    }
    setDeletingTx(null);
    router.refresh();
  }

  async function confirmDeleteAccount() {
    if (!deletingAccount) return;
    const response = await fetch(`/api/accounts/${deletingAccount.id}`, { method: "DELETE" });
    if (!response.ok) {
      setActionError("Não foi possível excluir a conta.");
      return;
    }
    setDeletingAccount(null);
    setAccountId("");
    router.refresh();
  }

  function handleSaved() {
    setAccountForm(null);
    setTransactionForm(null);
    router.refresh();
  }

  const heroCurrency = selectedAccount?.currency ?? "BRL";
  const heroValue = selectedAccount
    ? selectedAccount.balance
    : cash;
  const heroLabel = selectedAccount
    ? selectedAccount.type === "CARTAO_CREDITO" ? "Fatura atual" : "Saldo da conta"
    : "Saldo disponível";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Conta</h1>
          <p className="text-sm text-muted mt-1">Extrato, entradas, saídas e transferências entre as suas contas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setAccountForm("new")}>Nova conta</Button>
          <Button onClick={() => setTransactionForm("new")} disabled={initialAccounts.length === 0}>Nova movimentação</Button>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-surface px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-muted">{heroLabel}</p>
            <p className={`mt-1 text-4xl font-semibold tracking-tight tabular-nums ${selectedAccount?.type === "CARTAO_CREDITO" && heroValue > 0 ? "text-danger" : ""}`}>
              {formatCurrency(heroValue, heroCurrency)}
            </p>
            {invoices > 0 && !selectedAccount && (
              <p className="mt-2 text-sm text-danger">Faturas em aberto {formatCurrency(invoices, "BRL")}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-muted">Entradas</p>
              <p className="mt-1 font-semibold tabular-nums text-success">{formatCurrency(initialSummary.income, heroCurrency)}</p>
            </div>
            <div>
              <p className="text-muted">Saídas</p>
              <p className="mt-1 font-semibold tabular-nums text-danger">{formatCurrency(initialSummary.expense, heroCurrency)}</p>
            </div>
            <div>
              <p className="text-muted">Resultado</p>
              <p className={`mt-1 font-semibold tabular-nums ${initialSummary.net >= 0 ? "text-success" : "text-danger"}`}>
                {formatCurrency(initialSummary.net, heroCurrency)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {initialAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">Nenhuma conta ainda</p>
            <p className="text-sm text-muted mt-1">Crie uma conta corrente, poupança ou cartão para começar o extrato.</p>
            <Button className="mt-4" onClick={() => setAccountForm("new")}>Abrir primeira conta</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => changeAccount("")}
            className={`min-w-[9.5rem] rounded-2xl border px-4 py-3 text-left ${accountId === "" ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
          >
            <p className="text-xs text-muted">Todas</p>
            <p className="mt-2 text-sm font-semibold tabular-nums">{formatCurrency(cash, "BRL")}</p>
          </button>
          {initialAccounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => changeAccount(account.id)}
              className={`min-w-[13.5rem] rounded-2xl bg-gradient-to-br px-4 py-3 text-left shadow-sm ${accountTone(account.type)} ${accountId === account.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
            >
              <p className="text-[11px] opacity-70">{BANK_ACCOUNT_TYPE_LABELS[account.type]}</p>
              <p className="mt-1 text-sm font-semibold truncate">{account.name}</p>
              <p className="mt-3 text-lg font-semibold tabular-nums">
                {formatCurrency(account.balance, account.currency)}
              </p>
              <p className="text-[11px] opacity-70 truncate">
                {account.type === "CARTAO_CREDITO" && account.creditLimit != null
                  ? `Disponível ${formatCurrency(account.availableLimit ?? 0, account.currency)}`
                  : account.institution}
              </p>
            </button>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-surface">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => changeMonth(-1)}>‹</Button>
            <p className="min-w-40 text-center text-sm font-semibold capitalize">
              {format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: ptBR })}
            </p>
            <Button variant="secondary" size="sm" onClick={() => changeMonth(1)}>›</Button>
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:max-w-md sm:flex-row">
            <Select value={accountId} onChange={(event) => changeAccount(event.target.value)}>
              <option value="">Todas as contas</option>
              {initialAccounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </Select>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no extrato" />
          </div>
        </div>

        {selectedAccount && (
          <div className="flex justify-end gap-2 px-5 pt-3">
            <Button variant="ghost" size="sm" onClick={() => setAccountForm(selectedAccount)}>Editar conta</Button>
            <Button variant="ghost" size="sm" onClick={() => setDeletingAccount(selectedAccount)}>Excluir conta</Button>
          </div>
        )}

        {groups.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            Nenhuma movimentação neste período.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {groups.map(([day, items]) => (
              <div key={day}>
                <p className="px-5 pt-4 pb-1 text-xs font-medium text-muted">{dayLabel(items[0].date)}</p>
                <ul>
                  {items.map((item) => {
                    const inflow = item.type === "CREDITO" || (item.type === "TRANSFERENCIA" && item.isIncoming);
                    const amountClass = item.accountType === "CARTAO_CREDITO"
                      ? item.signedAmount > 0 ? "text-danger" : "text-success"
                      : inflow ? "text-success" : "text-danger";
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted/70">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setTransactionForm(item)}>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: item.categoryColor ?? "var(--muted)" }}
                            />
                            <p className="truncate text-sm font-medium">{item.description}</p>
                          </div>
                          <p className="mt-0.5 truncate pl-4.5 text-xs text-muted">
                            {[item.categoryParentName, item.categoryName].filter(Boolean).join(" · ") || BANK_TRANSACTION_TYPE_LABELS[item.type]}
                            {" · "}
                            {item.accountName}
                            {item.counterpartAccountName ? ` → ${item.counterpartAccountName}` : ""}
                            {item.installmentCount ? ` · ${item.installmentIndex}/${item.installmentCount}` : ""}
                            {item.tags?.length ? ` · ${item.tags.map((tag) => `#${tag}`).join(" ")}` : ""}
                          </p>
                        </button>
                        <div className="flex items-center gap-3">
                          <p className={`text-sm font-semibold tabular-nums ${amountClass}`}>
                            {inflow ? "+" : "−"} {formatCurrency(item.amount, selectedAccount?.currency ?? "BRL")}
                          </p>
                          <Button variant="ghost" size="sm" onClick={() => setDeletingTx(item)}>Excluir</Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={accountForm !== null} onClose={() => setAccountForm(null)} title={accountForm && accountForm !== "new" ? "Editar conta" : "Nova conta"}>
        <AccountForm account={accountForm && accountForm !== "new" ? accountForm : null} onSaved={handleSaved} onCancel={() => setAccountForm(null)} />
      </Modal>

      <Modal open={transactionForm !== null} onClose={() => setTransactionForm(null)} title={transactionForm && transactionForm !== "new" ? "Editar movimentação" : "Nova movimentação"}>
        {initialAccounts.length > 0 && (
          <TransactionForm
            accounts={initialAccounts}
            categories={categories}
            transaction={transactionForm && transactionForm !== "new" ? transactionForm : null}
            defaultAccountId={accountId || initialAccounts[0].id}
            onSaved={handleSaved}
            onCancel={() => setTransactionForm(null)}
          />
        )}
      </Modal>

      <Modal open={!!deletingTx} onClose={() => setDeletingTx(null)} title="Excluir movimentação">
        <div className="flex flex-col gap-4">
          <p className="text-sm">Excluir <strong>{deletingTx?.description}</strong>? Transferências saem das duas contas.</p>
          {actionError && <p className="text-sm text-danger">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletingTx(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDeleteTransaction}>Excluir</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deletingAccount} onClose={() => setDeletingAccount(null)} title="Excluir conta">
        <div className="flex flex-col gap-4">
          <p className="text-sm">Excluir <strong>{deletingAccount?.name}</strong> e todo o extrato dessa conta?</p>
          {actionError && <p className="text-sm text-danger">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletingAccount(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDeleteAccount}>Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
