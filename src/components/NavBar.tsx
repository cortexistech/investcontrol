"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BrandMark } from "@/components/BrandMark";
import type { LicensePayload } from "@/lib/license";
import { AccountMenu } from "@/components/AccountMenu";

const LINKS = [
  { href: "/", label: "Painel" },
  { href: "/conta", label: "Conta" },
  { href: "/planejamento", label: "Planejamento" },
  { href: "/investimentos", label: "Investimentos" },
  { href: "/patrimonio", label: "Patrimônio" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/configuracoes", label: "Configurações" },
];

export function NavBar({ license, userEmail }: { license: LicensePayload | null; userEmail: string | null }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface/95 backdrop-blur sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[4.5rem] flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-lg shrink-0">
          <BrandMark className="h-8 w-8 rounded-lg" />
          Investe Valor
        </Link>
        {license && (
          <div className="flex items-center gap-3 min-w-0">
            <nav className="flex items-center gap-1 max-w-[calc(100vw-11rem)] overflow-x-auto pb-1">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "px-3 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:text-foreground hover:bg-surface-muted"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            </nav>
            {userEmail ? <AccountMenu email={userEmail} /> : <div className="text-xs text-muted">Sessão não iniciada</div>}
          </div>
        )}
      </div>
    </header>
  );
}
