import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, MonitorSmartphone, Sparkles } from "lucide-react";
import Layout from "@/components/layout/Layout";
import PreviewPanel from "@/components/landing/PreviewPanel";
import FormatoStage from "@/components/landing/FormatoStage";
import { slideUp } from "@/lib/animations";
import { CTA_FINAL, COMO_FUNCIONA, FORMATOS_COPY, HERO, TESTIMONIOS } from "@/lib/copy";
import { FORMATOS, NOMBRE_FORMATO } from "@/types/database";

const alEntrar = {
  variants: slideUp,
  initial: "hidden" as const,
  whileInView: "visible" as const,
  viewport: { once: true, margin: "-60px" },
};

export default function Index() {
  return (
    <Layout>
      {/* ── Hero ─────────────────────────────────────────────────
          Entra con CSS (.vm-entra), no con Framer Motion: el hero debe ser
          visible aunque el JS no hidrate. Ver nota en styles.css. */}
      <section id="producto" className="px-4 pb-16 pt-16 md:px-10 md:pb-24 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="vm-entra">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-vm-bg-soft px-3 py-1.5 text-xs font-medium text-vm-body">
              <Sparkles className="size-3.5 text-vm-primary" aria-hidden />
              Nuevo: Formato TikTok
            </span>
          </div>

          <h1
            className="vm-entra mt-6 text-4xl text-balance md:text-6xl lg:text-[64px]"
            style={{ animationDelay: "70ms" }}
          >
            {HERO.headline}
          </h1>

          <p
            className="vm-entra mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-vm-body"
            style={{ animationDelay: "140ms" }}
          >
            {HERO.subheadline}
          </p>

          <div
            className="vm-entra mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "210ms" }}
          >
            <Link
              to="/registro"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary px-6 text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover sm:w-auto"
            >
              {HERO.ctaPrimario}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              to="/demo"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg border px-6 text-sm font-medium text-vm-ink transition-colors hover:bg-vm-bg-soft sm:w-auto"
            >
              {HERO.ctaSecundario}
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-6xl">
          <PreviewPanel />
        </div>
      </section>

      {/* ── Formatos ─────────────────────────────────────────── */}
      <section id="formatos" className="border-t bg-vm-bg-soft px-4 py-20 md:px-10 md:py-28">
        <motion.div {...alEntrar} className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl text-balance md:text-4xl">Cuatro formatos. El mismo menú.</h2>
          <p className="mt-4 text-lg text-pretty text-vm-body">
            Tú eliges cómo se ve tu carta. Cambia de formato cuando quieras, sin volver a capturar
            nada.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-vm-body/80">
            <MonitorSmartphone className="size-3.5" aria-hidden />
            Compara cómo se ve cada formato en escritorio y en celular
          </p>
        </motion.div>

        <div className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-2">
          {FORMATOS.map((formato, i) => (
            <motion.article
              key={formato}
              variants={slideUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              className="rounded-xl border bg-white p-5 shadow-vm-1 transition-shadow hover:shadow-vm-2"
            >
              <FormatoStage formato={formato} />
              <p className="mt-5 text-xs font-medium tracking-wide text-vm-primary">
                {NOMBRE_FORMATO[formato].toUpperCase()}
              </p>
              <h3 className="mt-2 text-xl">{FORMATOS_COPY[formato].titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-vm-body">
                {FORMATOS_COPY[formato].descripcion}
              </p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ────────────────────────────────────── */}
      <section className="px-4 py-20 md:px-10 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-2 md:items-center">
          <motion.div {...alEntrar}>
            <h2 className="text-3xl text-balance md:text-4xl">{COMO_FUNCIONA.titulo}</h2>
            <p className="mt-5 text-lg leading-relaxed text-pretty text-vm-body">
              {COMO_FUNCIONA.parrafo}
            </p>
          </motion.div>

          <motion.div {...alEntrar} className="grid gap-4 sm:grid-cols-2">
            {COMO_FUNCIONA.estadisticas.map((stat) => (
              <div key={stat} className="rounded-xl border bg-vm-bg-soft p-6">
                <p className="font-display text-lg font-bold leading-snug text-vm-ink">{stat}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Testimonios ──────────────────────────────────────── */}
      <section className="border-t bg-vm-bg-soft px-4 py-20 md:px-10 md:py-28">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {TESTIMONIOS.map((t) => (
            <motion.blockquote
              key={t.texto}
              {...alEntrar}
              className="rounded-xl border bg-white p-7 shadow-vm-1"
            >
              <p className="text-lg leading-relaxed text-pretty text-vm-ink">“{t.texto}”</p>
              <footer className="mt-5 text-sm text-vm-body">
                <span className="font-medium text-vm-ink">{t.nombre}</span> · {t.negocio}
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────── */}
      <section className="px-4 py-20 md:px-10 md:py-28">
        <motion.div {...alEntrar} className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl text-balance md:text-4xl">{CTA_FINAL.headline}</h2>
          <p className="mt-4 text-lg text-pretty text-vm-body">{CTA_FINAL.subheadline}</p>
          <Link
            to="/registro"
            className="mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-vm-primary px-7 text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover"
          >
            {CTA_FINAL.boton}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </motion.div>
      </section>
    </Layout>
  );
}
