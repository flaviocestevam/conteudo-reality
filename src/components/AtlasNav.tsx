import { Link } from "@tanstack/react-router";

const items = [
  { to: "/" as const, label: "Status" },
  { to: "/participants" as const, label: "Perfis" },
  { to: "/intake" as const, label: "Material do dia" },
  { to: "/scripts" as const, label: "Roteiros" },
  { to: "/settings" as const, label: "Configurações" },
];

export function AtlasHeader({ current }: { current: (typeof items)[number]["to"] }) {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="text-lg font-bold tracking-tight">ATLAS</span>
          <span className="text-sm text-muted-foreground">Captura & Roteiro</span>
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className={
                current === it.to
                  ? "rounded-md bg-accent px-3 py-1.5 font-medium"
                  : "rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              }
            >
              {it.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
