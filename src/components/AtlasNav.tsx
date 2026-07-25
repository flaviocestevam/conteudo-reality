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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="font-serif text-xl leading-none text-foreground">Soul AI</span>
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.35em] text-primary sm:inline">
            Brasil
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-[11px] font-medium uppercase tracking-[0.2em]">
          {items.map((it) => {
            const active = current === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={
                  active
                    ? "relative px-3 py-2 text-foreground after:absolute after:inset-x-3 after:-bottom-[21px] after:h-px after:bg-primary"
                    : "px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
