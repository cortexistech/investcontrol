"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { TransactionForm } from "@/components/TransactionForm";
import { PortfolioPieChart } from "@/components/PortfolioPieChart";
import { formatBRL } from "@/lib/investment-calc";
import type { FinanceSnapshot } from "@/lib/finance";
import type { ExpenseCategoryDTO } from "@/lib/types";
import { serializeBankAccount } from "@/lib/types";

function money(value: number) {
  return formatBRL(value);
}

export function FinanceDashboard({
  snapshot,
  categories,
}: {
  snapshot: FinanceSnapshot;
  categories: ExpenseCategoryDTO[];
}) {
  const router = useRouter();
  const [launchOpen, setLaunchOpen] = useState(false);
  const [purchase, setPurchase] = useState("200");
  const accounts = snapshot.accounts.map((account) => serializeBankAccount({
    ...account,
    createdAt: new Date(account.createdAt),
    updatedAt: new Date(account.updatedAt),
  }));

  const annualImpact = useMemo(() => Number(purchase || 0) * 12, [purchase]);
  const incomeImpact = snapshot.income > 0 ? annualImpact / (snapshot.income * 12) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Painel</h1>
          <p className="text-sm text-muted mt-1">Saldo, faturas, orçamento e o que vence nos próximos dias.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setLaunchOpen(true)} disabled={accounts.length === 0}>+ Lançamento rápido</Button>
          <Link href="/conta"><Button variant="secondary">Extrato</Button></Link>
          <Link href="/planejamento"><Button variant="secondary">Planejamento</Button></Link>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Saldo consolidado</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{money(snapshot.cash)}</p>
            <p className="text-xs text-muted mt-2">Contas, poupança e carteira</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Faturas do mês</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-3xl font-semibold tabular-nums ${snapshot.invoices > 0 ? "text-danger" : ""}`}>{money(snapshot.invoices)}</p>
            <p className="text-xs text-muted mt-2">{snapshot.cards.length ? `${snapshot.cards.length} cartão(ões)` : "Nenhum cartão cadastrado"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Saldo livre até o fim do mês</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-3xl font-semibold tabular-nums ${snapshot.freeUntilMonthEnd >= 0 ? "text-success" : "text-danger"}`}>{money(snapshot.freeUntilMonthEnd)}</p>
            <p className="text-xs text-muted mt-2">Já considera recorrências ainda não pagas</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Lançar agora</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted">Três cliques: abrir, preencher valor e confirmar.</p>
            <Button onClick={() => setLaunchOpen(true)} disabled={accounts.length === 0}>Registrar gasto ou entrada</Button>
            {accounts.length === 0 && <Link href="/conta" className="text-sm text-primary hover:underline">Abra uma conta primeiro</Link>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Próximos vencimentos (7 dias)</CardTitle></CardHeader>
          <CardContent>
            {snapshot.dues.length === 0 ? (
              <p className="text-sm text-muted">Nada vence nesta semana.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {snapshot.dues.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-muted">{format(parseISO(item.date), "dd MMM", { locale: ptBR })} · {item.accountName}</p>
                    </div>
                    <p className={`tabular-nums font-semibold ${item.type === "CREDITO" ? "text-success" : "text-danger"}`}>{money(item.amount)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tetos do mês</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {snapshot.budgets.length === 0 ? (
              <p className="text-sm text-muted">Defina limites em <Link href="/planejamento" className="text-primary hover:underline">Planejamento</Link>.</p>
            ) : snapshot.budgets.map((budget) => {
              const percent = Math.min(100, (budget.spent / budget.limit) * 100);
              return (
                <div key={budget.id}>
                  <div className="flex justify-between text-sm">
                    <span>{budget.categoryName}</span>
                    <span className="tabular-nums text-muted">{money(budget.spent)} / {money(budget.limit)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-muted overflow-hidden">
                    <div className={`h-full ${percent >= 100 ? "bg-danger" : "bg-primary"}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {snapshot.cards.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {snapshot.cards.map((card) => (
            <Card key={card.id}>
              <CardHeader><CardTitle>{card.name}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted">Fatura aberta</p>
                <p className="text-2xl font-semibold tabular-nums text-danger">{money(card.invoice)}</p>
                {card.limit != null && (
                  <>
                    <div className="mt-3 h-2 rounded-full bg-surface-muted overflow-hidden">
                      <div className="h-full bg-danger" style={{ width: `${card.usedPercent ?? 0}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-muted">Disponível {money(card.available ?? 0)} de {money(card.limit)}{card.dueDay ? ` · vence dia ${card.dueDay}` : ""}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Metas e reserva</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-muted">Reserva de emergência</p>
              <p className="text-xl font-semibold tabular-nums">{snapshot.reserveMonths.toFixed(1)} meses</p>
              <p className="text-xs text-muted">{money(snapshot.reserve)} cobrindo {money(snapshot.monthlyCost)} / mês</p>
              <div className="mt-2 h-2 rounded-full bg-surface-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (snapshot.reserveMonths / 6) * 100)}%` }} />
              </div>
            </div>
            {snapshot.goals.filter((goal) => goal.kind === "OBJETIVO").length === 0 ? (
              <p className="text-sm text-muted">Crie caixinhas em Planejamento.</p>
            ) : snapshot.goals.filter((goal) => goal.kind === "OBJETIVO").map((goal) => {
              const percent = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm">
                    <span>{goal.name}</span>
                    <span className="tabular-nums text-muted">{percent.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Patrimônio e poupança</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted">Investimentos</p>
            <p className="text-2xl font-semibold tabular-nums">{money(snapshot.investmentsNet)}</p>
            <p className="text-sm text-muted mt-2">Taxa de poupança do mês</p>
            <p className="text-2xl font-semibold tabular-nums">{(snapshot.savingsRate * 100).toFixed(1)}%</p>
            <p className="text-xs text-muted">{money(snapshot.net)} retidos sobre {money(snapshot.income)} de receita</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Onde foi o dinheiro</CardTitle></CardHeader>
          <CardContent>
            <PortfolioPieChart data={snapshot.moneyFlow} />
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Fluxo de caixa futuro</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            {snapshot.cashFlow.map((item) => (
              <div key={item.days}>
                <p className="text-xs text-muted">{item.days} dias</p>
                <p className={`mt-1 font-semibold tabular-nums ${item.balance >= 0 ? "text-success" : "text-danger"}`}>{money(item.balance)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Simulador de decisão</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted">Quanto uma nova conta recorrente pesa no ano.</p>
            <Input type="number" min="0" step="0.01" value={purchase} onChange={(event) => setPurchase(event.target.value)} />
            <p className="text-sm">Impacto anual <strong className="tabular-nums">{money(annualImpact)}</strong></p>
            <p className="text-xs text-muted">{snapshot.income > 0 ? `${(incomeImpact * 100).toFixed(1)}% da receita anual atual` : "Cadastre uma receita para ver o peso percentual."}</p>
          </CardContent>
        </Card>
      </section>

      <Modal open={launchOpen} onClose={() => setLaunchOpen(false)} title="Lançamento rápido">
        {accounts.length > 0 && (
          <TransactionForm
            accounts={accounts}
            categories={categories}
            transaction={null}
            compact
            onSaved={() => {
              setLaunchOpen(false);
              router.refresh();
            }}
            onCancel={() => setLaunchOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}
