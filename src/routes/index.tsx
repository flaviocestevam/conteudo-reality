import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Conteúdo Reality — Tudo sobre Reality Shows" },
      {
        name: "description",
        content:
          "Acompanhe as últimas notícias, análises e bastidores dos maiores reality shows. Conteúdo Reality é o seu destino para ficar por dentro de tudo.",
      },
      {
        property: "og:title",
        content: "Conteúdo Reality — Tudo sobre Reality Shows",
      },
      {
        property: "og:description",
        content:
          "Acompanhe as últimas notícias, análises e bastidores dos maiores reality shows.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const highlights = [
  {
    title: "Notícias em tempo real",
    description:
      "Fique por dentro dos acontecimentos mais recentes dos realities que o Brasil inteiro acompanha.",
  },
  {
    title: "Análises e opinião",
    description:
      "Textos aprofundados sobre jogadas, estratégias e os momentos que definem cada edição.",
  },
  {
    title: "Bastidores e entrevistas",
    description:
      "Conteúdo exclusivo com participantes, ex-participantes e os bastidores da produção.",
  },
];

const featuredPosts = [
  {
    category: "Big Brother Brasil",
    title: "Como o jogo do líder mudou a dinâmica da semana",
    excerpt:
      "A conquista do poder deu novos ares ao jogo e reposicionou as alianças dentro da casa.",
  },
  {
    category: "A Fazenda",
    title: "Roça formada: quem deve ficar e quem deve sair?",
    excerpt:
      "Analisamos o desempenho, a popularidade e as estratégias dos peões indicados.",
  },
  {
    category: "MasterChef",
    title: "A prova que eliminou um dos favoritos do público",
    excerpt:
      "Erro técnico e pressão do tempo selaram o destaque de um dos cozinheiros mais queridos.",
  },
];

function Index() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
      setEmail("");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Conteúdo Reality
          </Link>
          <nav className="hidden gap-6 text-sm font-medium sm:flex">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              Início
            </Link>
            <span className="cursor-pointer text-muted-foreground hover:text-foreground">
              Notícias
            </span>
            <span className="cursor-pointer text-muted-foreground hover:text-foreground">
              Análises
            </span>
            <span className="cursor-pointer text-muted-foreground hover:text-foreground">
              Sobre
            </span>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
            O universo dos reality shows
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
            Tudo sobre reality, em um só lugar
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Notícias, análises e bastidores dos maiores realities. Acompanhe as
            edições que movimentam o Brasil e o mundo.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Explorar conteúdo
            </Link>
            <span className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-input bg-background px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent">
              Receber atualizações
            </span>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="border-y border-border bg-muted/50 px-4 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured posts */}
      <section className="px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Destaques
              </h2>
              <p className="mt-2 text-muted-foreground">
                Os assuntos mais quentes dos últimos dias.
              </p>
            </div>
            <span className="hidden cursor-pointer text-sm font-medium text-primary hover:underline sm:inline">
              Ver todos
            </span>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredPosts.map((post) => (
              <article
                key={post.title}
                className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {post.category}
                </span>
                <h3 className="mt-3 text-lg font-semibold leading-snug group-hover:text-primary">
                  {post.title}
                </h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  {post.excerpt}
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                  Ler mais
                  <svg
                    className="ml-1 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-primary px-4 py-16 text-primary-foreground">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Não perca nenhuma atualização
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            Receba as principais notícias e análises de reality shows direto no
            seu e-mail.
          </p>
          {submitted ? (
            <div className="mt-6 rounded-xl bg-primary-foreground/10 p-6">
              <p className="font-medium">Inscrição confirmada!</p>
              <p className="text-sm text-primary-foreground/80">
                Em breve você recebe nossas atualizações.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubscribe}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-primary-foreground placeholder:text-primary-foreground/50 focus:border-primary-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-foreground/20 sm:w-80"
              />
              <button
                type="submit"
                className="rounded-lg bg-primary-foreground px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-foreground/90"
              >
                Inscrever-se
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Conteúdo Reality. Todos os direitos
            reservados.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span className="cursor-pointer hover:text-foreground">Instagram</span>
            <span className="cursor-pointer hover:text-foreground">Twitter</span>
            <span className="cursor-pointer hover:text-foreground">YouTube</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
