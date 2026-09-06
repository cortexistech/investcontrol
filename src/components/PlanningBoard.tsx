"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";
import type { BankAccountDTO, ExpenseCategoryDTO } from "@/lib/types";
import type { FinanceSnapshot } from "@/lib/finance";
import { formatBRL } from "@/lib/investment-calc";

export function PlanningBoard({
  snapshot,
  accounts,
  categories,
}: {
  snapshot: FinanceSnapshot;
  accounts: BankAccountDTO[];
  categories: ExpenseCategoryDTO[];
}) {
  const router = useRouter();
  const parents = categories.filter((item) => !item.parentId && item.kind !== "ENTRADA");
  const [budgetCategory, setBudgetCategory] = useState(parents[0]?.id ?? "");
  const [budgetAmount, setBudgetAmount] = useState("1500");
  const [recDescription, setRecDescription] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recDay, setRecDay] = useState("10");
  const [recAccount, setRecAccount] = useState(accounts[0]?.id ?? "");
  const [recType, setRecType] = useState<"DEBITO" | "CREDITO">("DEBITO");
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("0");
  const [goalKind, setGoalKind] = useState<"OBJETIVO" | "RESERVA">("OBJETIVO");

  async function saveBudget(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: budgetCategory, year: snapshot.year, month: snapshot.month, amount: Number(budgetAmount) }),
    });
    router.refresh();
  }

  async function saveRecurrence(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/recurrences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: recAccount,
        type: recType,
        amount: Number(recAmount),
        description: recDescription,
        dayOfMonth: Number(recDay),
        startDate: new Date().toISOString().slice(0, 10),
      }),
    });
    setRecDescription("");
    setRecAmount("");
    router.refresh();
  }

  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: goalName,
        kind: goalKind,
        targetAmount: Number(goalTarget),
        currentAmount: Number(goalCurrent),
      }),
    });
    setGoalName("");
    setGoalTarget("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Planejamento</h1>
        <p className="text-sm text-muted mt-1">Tetos mensais, contas fixas e metas com reserva de emergência.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Orçamento por teto</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={saveBudget} className="flex flex-col gap-3">
              <div>
                <Label htmlFor="budget-cat">Categoria</Label>
                <Select id="budget-cat" value={budgetCategory} onChange={(event) => setBudgetCategory(event.target.value)}>
                  {parents.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="budget-amount">Limite do mês</Label>
                <Input id="budget-amount" type="number" min="1" step="0.01" value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} required />
              </div>
              <Button type="submit" disabled={!budgetCategory}>Salvar teto</Button>
            </form>
            <ul className="flex flex-col gap-3">
              {snapshot.budgets.map((budget) => (
                <li key={budget.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{budget.categoryName} · {formatBRL(budget.spent)} / {formatBRL(budget.limit)}</span>
                  <Button variant="ghost" size="sm" onClick={async () => { await fetch(`/api/budgets?id=${budget.id}`, { method: "DELETE" }); router.refresh(); }}>Excluir</Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contas fixas e recorrências</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={saveRecurrence} className="flex flex-col gap-3">
              <Input value={recDescription} onChange={(event) => setRecDescription(event.target.value)} placeholder="Aluguel, salário, internet..." required />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" min="0.01" step="0.01" value={recAmount} onChange={(event) => setRecAmount(event.target.value)} placeholder="Valor" required />
                <Input type="number" min="1" max="31" value={recDay} onChange={(event) => setRecDay(event.target.value)} required />
              </div>
              <Select value={recType} onChange={(event) => setRecType(event.target.value as "DEBITO" | "CREDITO")}>
                <option value="DEBITO">Conta a pagar</option>
                <option value="CREDITO">Receita recorrente</option>
              </Select>
              <Select value={recAccount} onChange={(event) => setRecAccount(event.target.value)}>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </Select>
              <Button type="submit" disabled={!recAccount}>Adicionar recorrência</Button>
            </form>
            <ul className="flex flex-col gap-3">
              {snapshot.recurrences.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{item.description} · dia {item.dayOfMonth} · {formatBRL(item.amount)}</span>
                  <Button variant="ghost" size="sm" onClick={async () => { await fetch(`/api/recurrences?id=${item.id}`, { method: "DELETE" }); router.refresh(); }}>Excluir</Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Metas e envelopes</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={saveGoal} className="flex flex-col gap-3">
              <Input value={goalName} onChange={(event) => setGoalName(event.target.value)} placeholder="Viagem, carro, IPVA..." required />
              <Select value={goalKind} onChange={(event) => setGoalKind(event.target.value as "OBJETIVO" | "RESERVA")}>
                <option value="OBJETIVO">Objetivo</option>
                <option value="RESERVA">Reserva de emergência</option>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" min="1" step="0.01" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} placeholder="Meta" required />
                <Input type="number" min="0" step="0.01" value={goalCurrent} onChange={(event) => setGoalCurrent(event.target.value)} placeholder="Já guardado" />
              </div>
              <Button type="submit">Criar caixinha</Button>
            </form>
            <ul className="flex flex-col gap-3">
              {snapshot.goals.map((goal) => (
                <li key={goal.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{goal.name} · {formatBRL(goal.currentAmount)} / {formatBRL(goal.targetAmount)}</span>
                  <Button variant="ghost" size="sm" onClick={async () => { await fetch(`/api/goals?id=${goal.id}`, { method: "DELETE" }); router.refresh(); }}>Excluir</Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
