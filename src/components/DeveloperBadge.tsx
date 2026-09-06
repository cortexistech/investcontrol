import Image from "next/image";

export function DeveloperBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://cortexists.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors ${className}`}
    >
      <Image src="/brand/cortexis-logo-small.png" alt="" width={20} height={16} className="rounded-sm" aria-hidden="true" />
      <span>
        Desenvolvido por <span className="font-semibold">Cortexis</span>
      </span>
    </a>
  );
}
