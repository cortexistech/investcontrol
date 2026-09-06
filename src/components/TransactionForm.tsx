"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import type { BankAccountDTO, BankTransactionDTO, ExpenseCategoryDTO } from "@/lib/types";
import type { BankTransactionType } from "@/generated/prisma/client";
import { BANK_TRANSACTION_TYPE_LABELS } from "@/lib/labels";

function toDateInputValue(iso?: string) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10);
}

export function TransactionForm({
  accounts,
  categories,
  transaction,
  defaultAccountId,
  compact = false,
  onSaved,
  onCancel,
}: {
  accounts: BankAccountDTO[];
  categories: ExpenseCategoryDTO[];
  transaction: BankTransactionDTO | null;
  defaultAccountId?: string;
  compact?: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const initialSource = transaction
    ? transaction.type === "TRANSFERENCIA" && transaction.isIncoming
      ? transaction.counterpartAccountId ?? transaction.accountId
      : transaction.accountId
    : defaultAccountId ?? accounts[0]?.id ?? "";
  const initialDestination = transaction
    ? transaction.type === "TRANSFERENCIA" && transaction.isIncoming
      ? transaction.accountId
      : transaction.counterpartAccountId ?? ""
    : "";

  const [type, setType] = useState<BankTransactionType>(transaction?.type ?? "DEBITO");
  const [accountId, setAccountId] = useState(initialSource);
  const [counterpartAccountId, setCounterpartAccountId] = useState(initialDestination);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [date, setDate] = useState(toDateInputValue(transaction?.date));
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [tags, setTags] = useState(transaction?.tags?.join(", ") ?? "");
  const [installmentCount, setInstallmentCount] = useState(transaction?.installmentCount ? String(transaction.installmentCount) : "1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleCategories = useMemo(() => {
    if (type === "CREDITO") return categories.filter((item) => item.kind !== "SAIDA");
    if (type === "DEBITO") return categories.filter((item) => item.kind !== "ENTRADA");
    return categories.filter((item) => item.kind === "AMBOS" || item.name === "Transferência");
  }, [categories, type]);
  const parents = visibleCategories.filter((item) => !item.parentId);
  const selectedParent = visibleCategories.find((item) => item.id === categoryId);
  const parentId = selectedParent?.parentId ?? selectedParent?.id ?? "";
  const children = visibleCategories.filter((item) => item.parentId === parentId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      accountId,
      counterpartAccountId: type === "TRANSFERENCIA" ? counterpartAccountId : null,
      type,
      amount: Number(amount),
      date,
      description,
      categoryId: categoryId || null,
      notes: notes || null,
      tags: tags || null,
      installmentCount: Number(installmentCount) || 1,
    };
    const response = await fetch(transaction ? `/api/transactions/${transaction.id}` : "/api/transactions", {
      method: transaction ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.formErrors?.[0] || body?.error?.fieldErrors?.counterpartAccountId?.[0] || body?.error || "Não foi possível registrar.");
      setSubmitting(false);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-muted p-1">
        {(["DEBITO", "CREDITO", "TRANSFERENCIA"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            className={`rounded-md px-2 py-2 text-xs font-semibold ${type === value ? "bg-surface text-foreground shadow-sm" : "text-muted"}`}
          >
            {BANK_TRANSACTION_TYPE_LABELS[value]}
          </button>
        ))}
      </div>
      <div>
        <Label htmlFor="tx-account">{type === "TRANSFERENCIA" ? "Saiu de" : "Conta"}</Label>
        <Select id="tx-account" value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </Select>
      </div>
      {type === "TRANSFERENCIA" && (
        <div>
          <Label htmlFor="tx-dest">Entrou em</Label>
          <Select id="tx-dest" value={counterpartAccountId} onChange={(event) => setCounterpartAccountId(event.target.value)} required>
            <option value="">Selecione a conta</option>
            {accounts.filter((account) => account.id !== accountId).map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tx-amount">Valor</Label>
          <Input id="tx-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="tx-date">Data</Label>
          <Input id="tx-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </div>
      </div>
      <div>
        <Label htmlFor="tx-description">Descrição</Label>
        <Input id="tx-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Aluguel, iFood, salário..." required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tx-category">Categoria</Label>
          <Select id="tx-category" value={parentId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Sem categoria</option>
            {parents.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="tx-subcategory">Subcategoria</Label>
          <Select id="tx-subcategory" value={selectedParent?.parentId ? categoryId : ""} onChange={(event) => setCategoryId(event.target.value || parentId)} disabled={!parentId}>
            <option value="">Geral</option>
            {children.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="tx-tags">Tags</Label>
        <Input id="tx-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="#viagem-ferias, #trabalho" />
      </div>
      {type === "DEBITO" && (
        <div>
          <Label htmlFor="tx-installments">Parcelas</Label>
          <Input id="tx-installments" type="number" min="1" max="48" value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} />
        </div>
      )}
      {!compact && (
        <div>
          <Label htmlFor="tx-notes">Observação</Label>
          <Input id="tx-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" />
        </div>
      )}
      {error && <p className="text-sm text-danger">{typeof error === "string" ? error : "Revise os campos."}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Confirmar"}</Button>
      </div>
    </form>
  );
}
