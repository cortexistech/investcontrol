"use client";

import { Fragment, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import Link from "next/link";
import type { Currency } from "@/generated/prisma/client";

type Entry = { id: string; year: number; month: number; institution: string; category: string; currency: Currency; value: number; contributions: number; withdrawals: number };
type PortfolioRates = { usdToBrl: number; eurToBrl: number };
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function PortfolioManager({ initialEntries, initialYear, rates }: { initialEntries: Entry[]; initialYear: number; rates: PortfolioRates }) {
  const [year, setYear] = useState(initialYear);
  const [entries, setEntries] = useState(initialEntries);
  const [institution, setInstitution] = useState("");
  const [category, setCategory] = useState("");
  const [currency, setCurrency] = useState<Currency>("BRL");
  const [applicationMonth, setApplicationMonth] = useState("1");
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<"APORTE" | "RETIRADA">("APORTE");
  const [movementInstitution, setMovementInstitution] = useState("");
  const [movementCategory, setMovementCategory] = useState("");
  const [movementMonth, setMovementMonth] = useState("1");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementError, setMovementError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<{ institution: string; category: string; currency: Currency } | null>(null);
  const [editInstitution, setEditInstitution] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCurrency, setEditCurrency] = useState<Currency>("BRL");
  const [editError, setEditError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"menu" | "add" | "edit" | "delete" | null>(null);
  const [actionKey, setActionKey] = useState("");

  async function deleteRow(row: { institution: string; category: string }) {
    if (!window.confirm(`Excluir ${row.category} da instituição ${row.institution}?`)) return;
    const response = await fetch("/api/portfolio", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, institution: row.institution, category: row.category }) });
    if (response.ok) setEntries((current) => current.filter((entry) => !(entry.year === year && entry.institution === row.institution && entry.category === row.category)));
  }

  function openEditRow(row: { institution: string; category: string; currency: Currency }) {
    setEditingRow(row);
    setEditInstitution(row.institution);
    setEditCategory(row.category);
    setEditCurrency(row.currency);
    setEditError(null);
  }

  function selectedActionRow() {
    return allRows.find((row) => `${row.institution}|${row.category}` === actionKey);
  }

  function continueAction() {
    const row = selectedActionRow();
    if (!row) return;
    setActionMode(null);
    if (actionMode === "edit") openEditRow(row);
    else deleteRow(row);
  }

  function openActionMenu() {
    setActionMode("menu");
    setActionKey("");
    setError(null);
  }

  function openAddAction() {
    setActionMode("add");
    setError(null);
  }

  async function saveRowEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingRow) return;
    try {
      const response = await fetch("/api/portfolio", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, oldInstitution: editingRow.institution, oldCategory: editingRow.category, institution: editInstitution.trim(), category: editCategory.trim(), currency: editCurrency }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Não foi possível salvar a alteração.");
      setEntries((current) => current.map((entry) => entry.institution === editingRow.institution && entry.category === editingRow.category ? { ...entry, institution: editInstitution.trim(), category: editCategory.trim(), currency: editCurrency } : entry));
      setEditingRow(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erro inesperado ao salvar.");
    }
  }

  async function loadYear(nextYear: number) {
    setYear(nextYear);
    const response = await fetch(`/api/portfolio?year=${nextYear}`);
    if (response.ok) setEntries(await response.json());
  }

  async function addRow(event: React.FormEvent) {
    event.preventDefault();
    if (!institution.trim() || !category.trim()) return false;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/portfolio", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, month: Number(applicationMonth), institution, category, currency, value: 0 }) });
      if (!response.ok) throw new Error("Não foi possível criar a aplicação.");
      const entry = await response.json();
      setEntries((current) => [...current, entry]);
      setInstitution("");
      setCategory("");
      setCurrency("BRL");
      setApplicationMonth("1");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveValue(row: { institution: string; category: string; currency?: Currency; [key: string]: unknown }, month: number, value: number, movementType?: "APORTE" | "RETIRADA", movementAmount = 0) {
    const response = await fetch("/api/portfolio", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...row, year, month, currency: row.currency, value, movementType, movementAmount }) });
    if (!response.ok) return;
    const saved = await response.json();
    setEntries((current) => {
      const without = current.filter((entry) => !(entry.institution === row.institution && entry.category === row.category && entry.month === month));
      return [...without, saved];
    });
  }

  function openMovement(type: "APORTE" | "RETIRADA") {
    const first = allRows[0];
    setMovementType(type);
    setMovementInstitution(first?.institution ?? "");
    setMovementCategory(first?.category ?? "");
    setMovementMonth("1");
    setMovementAmount("");
    setMovementError(null);
    setMovementOpen(true);
  }

  async function saveMovement(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(movementAmount);
    const month = Number(movementMonth);
    const selectedRow = allRows.find((item) => item.institution === movementInstitution && item.category === movementCategory);
    const row = { institution: movementInstitution, category: movementCategory, currency: selectedRow?.currency ?? "BRL" as Currency };
    const current = valueFor(row, month);
    if (!Number.isFinite(amount) || amount <= 0 || (movementType === "RETIRADA" && amount > current)) {
      setMovementError(movementType === "RETIRADA" ? "A retirada não pode ser maior que o valor do mês." : "Informe um valor válido.");
      return;
    }
    await saveValue(row, month, current + (movementType === "APORTE" ? amount : -amount), movementType, amount);
    setMovementOpen(false);
  }

  const allRows = Array.from(new Map(entries.map((entry) => [`${entry.institution}|${entry.category}`, { institution: entry.institution, category: entry.category, currency: entry.currency ?? "BRL" as Currency }])).values());
  const institutions = Array.from(new Set(allRows.map((row) => row.institution))).sort();
  const rows = allRows;
  const valueFor = (row: { institution: string; category: string }, month: number) => entries.find((entry) => entry.institution === row.institution && entry.category === row.category && entry.month === month)?.value ?? 0;
  const rentFor = (row: { institution: string; category: string }, month: number) => {
    const previousEntry = entries.find((entry) => entry.institution === row.institution && entry.category === row.category && entry.month === month - 1);
    const currentEntry = entries.find((entry) => entry.institution === row.institution && entry.category === row.category && entry.month === month);
    const previous = previousEntry?.value ?? 0;
    const current = currentEntry?.value ?? 0;
    const netFlow = (currentEntry?.contributions ?? 0) - (currentEntry?.withdrawals ?? 0);
    return previous > 0 ? (current - previous - netFlow) / previous : null;
  };
  const money = (value: number, rowCurrency: Currency = "BRL") => value.toLocaleString("pt-BR", { style: "currency", currency: rowCurrency });
  const currencyLabel = (rowCurrency: Currency) => rowCurrency === "USD" ? "US$ (USD)" : rowCurrency === "EUR" ? "€ (EUR)" : "R$ (BRL)";
  const toBRL = (value: number, rowCurrency: Currency) => rowCurrency === "USD" ? value * rates.usdToBrl : rowCurrency === "EUR" ? value * rates.eurToBrl : value;
  const currencyTotalFor = (rowCurrency: Currency, month: number) => rows.reduce((sum, row) => sum + (row.currency === rowCurrency ? valueFor(row, month) : 0), 0);
  const consolidatedTotalFor = (month: number) => rows.reduce((sum, row) => sum + toBRL(valueFor(row, month), row.currency), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.18em] text-primary font-semibold">Controle financeiro</p><h1 className="text-3xl font-semibold mt-1">Controle do Patrimônio</h1><p className="text-sm text-muted mt-1">Lançamentos mensais da carteira, aportes e retiradas.</p></div>
        <div className="flex items-center gap-2"><Label htmlFor="year">Ano</Label><Input id="year" aria-label="Ano" type="number" min="2000" max="2200" value={year} onChange={(event) => loadYear(Number(event.target.value))} className="w-28" /></div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"><div><p className="text-sm font-medium">Edição do patrimônio de {year}</p><p className="text-xs text-muted mt-0.5">Os valores são registrados mês a mês na moeda de cada aplicação.</p></div><Link href="/dashboard" className="shrink-0 text-sm font-medium text-primary hover:underline">Abrir Dashboard do Patrimônio →</Link></div>
      <Card>
        <CardContent className="pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><p className="font-medium">Gerenciar lançamentos</p><p className="text-xs text-muted mt-1">Adicione, altere ou exclua aplicações do patrimônio.</p></div>
          <div className="flex flex-wrap gap-2"><Button onClick={openActionMenu}>Abrir opções</Button><Button variant="secondary" onClick={() => openMovement("APORTE")} disabled={!allRows.length}>Registrar aporte</Button><Button variant="secondary" onClick={() => openMovement("RETIRADA")} disabled={!allRows.length}>Registrar retirada</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          <div className="mb-3"><p className="font-medium">Totais por moeda</p><p className="text-xs text-muted mt-1">Consolidado com 1 USD = {money(rates.usdToBrl)} e 1 EUR = {money(rates.eurToBrl)}.</p></div>
          <table className="w-full min-w-[780px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted"><th className="py-3">Mês</th><th className="py-3 text-right">BRL</th><th className="py-3 text-right">USD</th><th className="py-3 text-right">EUR</th><th className="py-3 text-right">Consolidado (BRL)</th></tr></thead><tbody>{MONTHS.map((month, index) => <tr key={month} className="border-b border-border"><td className="py-3 font-medium">{month}</td><td className="py-3 text-right">{money(currencyTotalFor("BRL", index + 1), "BRL")}</td><td className="py-3 text-right">{money(currencyTotalFor("USD", index + 1), "USD")}</td><td className="py-3 text-right">{money(currencyTotalFor("EUR", index + 1), "EUR")}</td><td className="py-3 text-right font-semibold">{money(consolidatedTotalFor(index + 1), "BRL")}</td></tr>)}</tbody></table>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[1900px]"><thead><tr className="border-b border-border text-left"><th className="px-4 py-3 sticky left-0 bg-surface">Instituição</th><th className="px-4 py-3 sticky left-[120px] bg-surface">Aplicação</th><th className="px-2 py-3 text-right">Dez ant. (moeda)</th>{MONTHS.map((month) => <th key={month} colSpan={2} className="px-2 py-3 text-center">{month}</th>)}</tr><tr className="border-b border-border text-xs text-muted"><th /><th /><th />{MONTHS.map((month) => <Fragment key={month}><th className="px-2 py-2 text-right">Valor (moeda)</th><th className="px-2 py-2 text-right">Rent. (%)</th></Fragment>)}</tr></thead>
            <tbody>{rows.map((row) => <tr key={`${row.institution}|${row.category}`} className="border-b border-border"><td className="px-4 py-2 font-medium whitespace-nowrap sticky left-0 bg-surface">{row.institution}</td><td className="px-4 py-2 whitespace-nowrap sticky left-[120px] bg-surface">{row.category} <span className="text-xs text-primary">{currencyLabel(row.currency)}</span></td><td className="px-1 py-1"><input key={`dez-${valueFor(row, 0)}`} aria-label={`${row.category} Dezembro anterior (${currencyLabel(row.currency)})`} placeholder={currencyLabel(row.currency)} className="w-28 rounded border border-border bg-background px-2 py-1.5 text-right" type="number" min="0" step="0.01" defaultValue={valueFor(row, 0) || ""} onBlur={(event) => saveValue({ ...row, id: "", year, month: 0, value: 0 }, 0, Number(event.target.value) || 0)} /></td>{MONTHS.map((_, index) => <Fragment key={index}><td className="px-1 py-1"><input key={`${index + 1}-${valueFor(row, index + 1)}`} aria-label={`${row.category} ${MONTHS[index]} (${currencyLabel(row.currency)})`} placeholder={currencyLabel(row.currency)} className="w-28 rounded border border-border bg-background px-2 py-1.5 text-right" type="number" min="0" step="0.01" defaultValue={valueFor(row, index + 1) || ""} onBlur={(event) => saveValue({ ...row, id: "", year, month: index + 1, value: 0 }, index + 1, Number(event.target.value) || 0)} /></td><td className={`px-2 py-1 text-right whitespace-nowrap ${((rentFor(row, index + 1) ?? 0) >= 0 ? "text-success" : "text-danger")}`}>{rentFor(row, index + 1) === null ? "-" : `${(rentFor(row, index + 1)! * 100).toFixed(2)}%`}</td></Fragment>)}</tr>)}
            </tbody>
          </table>
          {!rows.length && <p className="p-6 text-sm text-muted">Adicione a primeira instituição para começar.</p>}
        </CardContent>
      </Card>
      <Modal open={actionMode !== null} onClose={() => setActionMode(null)} title={actionMode === "menu" ? "Gerenciar lançamentos" : actionMode === "add" ? "Adicionar lançamento" : actionMode === "edit" ? "Alterar lançamento" : "Excluir lançamento"}>
          {actionMode === "menu" ? <div className="flex flex-col gap-3"><p className="text-sm text-muted">Escolha o que deseja fazer com os lançamentos do patrimônio.</p><Button onClick={openAddAction}>Adicionar lançamento</Button><Button variant="secondary" onClick={() => setActionMode("edit")}>Alterar lançamento</Button><Button variant="danger" onClick={() => setActionMode("delete")}>Excluir lançamento</Button></div> : actionMode === "add" ? <form onSubmit={async (event) => { const saved = await addRow(event); if (saved) setActionMode(null); }} className="flex flex-col gap-4"><div><Label htmlFor="institution">Instituição</Label><Input id="institution" value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="Ex.: Safra" required /></div><div><Label htmlFor="category">Aplicação ou conta</Label><Input id="category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ex.: Reserva financeira" required /></div><div><Label htmlFor="portfolioCurrency">Moeda</Label><Select id="portfolioCurrency" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}><option value="BRL">Real (BRL)</option><option value="USD">Dólar (USD)</option><option value="EUR">Euro (EUR)</option></Select></div><div><Label htmlFor="applicationMonth">Mês inicial</Label><Select id="applicationMonth" value={applicationMonth} onChange={(event) => setApplicationMonth(event.target.value)}>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</Select></div>{error && <p className="text-sm text-danger">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setActionMode(null)}>Cancelar</Button><Button type="submit" disabled={busy}>Adicionar</Button></div></form> : <div className="flex flex-col gap-4"><div><Label htmlFor="actionRow">Lançamento</Label><Select id="actionRow" value={actionKey} onChange={(event) => setActionKey(event.target.value)} required><option value="">Selecione uma aplicação</option>{allRows.map((row) => <option key={`${row.institution}|${row.category}`} value={`${row.institution}|${row.category}`}>{row.institution} · {row.category} · {currencyLabel(row.currency)}</option>)}</Select></div><p className="text-xs text-muted">{actionMode === "edit" ? "Na próxima etapa você poderá alterar os dados da linha." : "A exclusão removerá os valores de todos os meses desta linha."}</p><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setActionMode(null)}>Cancelar</Button><Button type="button" variant={actionMode === "delete" ? "danger" : "primary"} disabled={!actionKey} onClick={continueAction}>{actionMode === "edit" ? "Continuar" : "Excluir"}</Button></div></div>}
      </Modal>
      <Modal open={!!editingRow} onClose={() => setEditingRow(null)} title="Alterar lançamento"><form onSubmit={saveRowEdit} className="flex flex-col gap-4"><div><Label htmlFor="editInstitution">Instituição</Label><Input id="editInstitution" value={editInstitution} onChange={(event) => setEditInstitution(event.target.value)} required /></div><div><Label htmlFor="editCategory">Aplicação ou conta</Label><Input id="editCategory" value={editCategory} onChange={(event) => setEditCategory(event.target.value)} required /></div><div><Label htmlFor="editCurrency">Moeda</Label><Select id="editCurrency" value={editCurrency} onChange={(event) => setEditCurrency(event.target.value as Currency)}><option value="BRL">Real (BRL)</option><option value="USD">Dólar (USD)</option><option value="EUR">Euro (EUR)</option></Select></div>{editError && <p className="text-sm text-danger">{editError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditingRow(null)}>Cancelar</Button><Button type="submit">Salvar alteração</Button></div></form></Modal>
      <Modal open={movementOpen} onClose={() => setMovementOpen(false)} title={movementType === "APORTE" ? "Registrar aporte" : "Registrar retirada"}><form onSubmit={saveMovement} className="flex flex-col gap-4"><div><Label htmlFor="movementInstitution">Instituição</Label><Select id="movementInstitution" value={movementInstitution} onChange={(event) => { setMovementInstitution(event.target.value); setMovementCategory(allRows.find((row) => row.institution === event.target.value)?.category ?? ""); }}>{institutions.map((item) => <option key={item}>{item}</option>)}</Select></div><div><Label htmlFor="movementCategory">Aplicação</Label><Select id="movementCategory" value={movementCategory} onChange={(event) => setMovementCategory(event.target.value)}>{allRows.filter((row) => row.institution === movementInstitution).map((row) => <option key={row.category}>{row.category}</option>)}</Select><p className="text-[11px] text-muted mt-1">Moeda: {allRows.find((row) => row.institution === movementInstitution && row.category === movementCategory)?.currency ?? "BRL"}</p></div><div><Label htmlFor="movementMonth">Mês</Label><Select id="movementMonth" value={movementMonth} onChange={(event) => setMovementMonth(event.target.value)}>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</Select></div><div><Label htmlFor="movementAmount">Valor na moeda da aplicação</Label><Input id="movementAmount" type="number" min="0.01" step="0.01" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} required /></div>{movementError && <p className="text-sm text-danger">{movementError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setMovementOpen(false)}>Cancelar</Button><Button type="submit">Registrar</Button></div></form></Modal>
    </div>
  );
}