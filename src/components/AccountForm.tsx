"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import type { BankAccountDTO } from "@/lib/types";
import type { BankAccountType, Currency } from "@/generated/prisma/client";
import { BANK_ACCOUNT_TYPE_LABELS } from "@/lib/labels";
import { bankAccountTypeValues, currencyValues } from "@/lib/validation";

export function AccountForm({
  account,
  onSaved,
  onCancel,
}: {
  account: BankAccountDTO | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [type, setType] = useState<BankAccountType>(account?.type ?? "CORRENTE");
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? "BRL");
  const [initialBalance, setInitialBalance] = useState(account ? String(account.initialBalance) : "0");
  const [creditLimit, setCreditLimit] = useState(account?.creditLimit != null ? String(account.creditLimit) : "");
  const [closingDay, setClosingDay] = useState(account?.closingDay != null ? String(account.closingDay) : "10");
  const [dueDay, setDueDay] = useState(account?.dueDay != null ? String(account.dueDay) : "17");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      name,
      institution,
      type,
      currency,
      initialBalance: Number(initialBalance),
      creditLimit: type === "CARTAO_CREDITO" && creditLimit ? Number(creditLimit) : null,
      closingDay: type === "CARTAO_CREDITO" && closingDay ? Number(closingDay) : null,
      dueDay: type === "CARTAO_CREDITO" && dueDay ? Number(dueDay) : null,
    };
    const response = await fetch(account ? `/api/accounts/${account.id}` : "/api/accounts", {
      method: account ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.formErrors?.[0] || body?.error || "Não foi possível salvar a conta.");
      setSubmitting(false);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="account-name">Nome da conta</Label>
        <Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nubank, Itaú, Carteira..." required />
      </div>
      <div>
        <Label htmlFor="account-institution">Instituição</Label>
        <Input id="account-institution" value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="Banco ou carteira" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="account-type">Tipo</Label>
          <Select id="account-type" value={type} onChange={(event) => setType(event.target.value as BankAccountType)}>
            {bankAccountTypeValues.map((value) => (
              <option key={value} value={value}>{BANK_ACCOUNT_TYPE_LABELS[value]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="account-currency">Moeda</Label>
          <Select id="account-currency" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
            {currencyValues.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="account-balance">{type === "CARTAO_CREDITO" ? "Fatura aberta" : "Saldo inicial"}</Label>
        <Input id="account-balance" type="number" step="0.01" value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} required />
        <p className="text-xs text-muted mt-1">
          {type === "CARTAO_CREDITO"
            ? "Quanto já está na fatura hoje. As compras somam; os pagamentos abatem."
            : "Saldo atual desta conta. As próximas movimentações entram no extrato."}
        </p>
      </div>
      {type === "CARTAO_CREDITO" && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="account-limit">Limite</Label>
            <Input id="account-limit" type="number" min="0" step="0.01" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="account-close">Fecha dia</Label>
            <Input id="account-close" type="number" min="1" max="31" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="account-due">Vence dia</Label>
            <Input id="account-due" type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger">{typeof error === "string" ? error : "Revise os campos."}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar conta"}</Button>
      </div>
    </form>
  );
}
