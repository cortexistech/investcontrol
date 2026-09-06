import { NextResponse } from "next/server";
import { createGoal, deleteGoal, updateGoal } from "@/lib/finance";
import { getLicenseOrNull, licenseErrorResponse } from "@/lib/license";
import { getAuthenticatedUserOrNull } from "@/lib/auth";
import { goalSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = goalSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await createGoal(parsed.data), { status: 201 });
}

export async function PUT(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json();
  const id = typeof body?.id === "string" ? body.id : "";
  const parsed = goalSchema.safeParse(body);
  if (!id || !parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  return NextResponse.json(await updateGoal(id, parsed.data));
}

export async function DELETE(request: Request) {
  if (!getLicenseOrNull()) return licenseErrorResponse();
  if (!(await getAuthenticatedUserOrNull())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Informe a meta." }, { status: 400 });
  await deleteGoal(id);
  return NextResponse.json({ ok: true });
}
