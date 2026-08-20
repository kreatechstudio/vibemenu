import type { ReactNode } from "react";
import Layout from "@/components/layout/Layout";
import { VIGENCIA_LEGAL } from "@/lib/legal";

export type SeccionLegal = {
  id: string;
  titulo: string;
  contenido: ReactNode;
};

interface PaginaLegalProps {
  titulo: string;
  resumen: string;
  secciones: SeccionLegal[];
}

/**
 * Cascarón compartido de Privacidad y Cookies: mismo encabezado, mismo
 * índice y misma tipografía de cuerpo largo. El contenido lo pone cada página.
 */
export default function PaginaLegal({ titulo, resumen, secciones }: PaginaLegalProps) {
  return (
    <Layout>
      <article className="mx-auto max-w-5xl px-4 py-16 md:px-10 md:py-24">
        <header className="max-w-2xl">
          <p className="vm-data text-xs tracking-wide text-vm-primary uppercase">
            Vigente desde el {VIGENCIA_LEGAL}
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl">{titulo}</h1>
          <p className="mt-4 text-lg text-pretty text-vm-body">{resumen}</p>
        </header>

        <div className="mt-14 grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-16">
          <nav aria-label="Índice" className="hidden lg:block">
            <div className="sticky top-24 space-y-1 border-l border-vm-border pl-4">
              {secciones.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block py-1 text-sm text-vm-body hover:text-vm-primary"
                >
                  {s.titulo}
                </a>
              ))}
            </div>
          </nav>

          <div className="min-w-0 space-y-12">
            {secciones.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-xl md:text-2xl">{s.titulo}</h2>
                <div className="mt-3 max-w-3xl space-y-3 text-[15px] leading-relaxed text-vm-body [&_a]:text-vm-primary [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-vm-ink">
                  {s.contenido}
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>
    </Layout>
  );
}
