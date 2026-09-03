import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { BorderBeam } from "@/components/ui/border-beam";
import { usePlanes } from "@/hooks/usePlanes";
import { formatearPrecio, porcentajeAhorroAnual, precioDelPlan } from "@/lib/plan";
import { filasDeGrupo, gruposConFilas, type FilaComparativa } from "@/lib/comparativa";
import { PLANES_COPY, PRECIOS } from "@/lib/copy";
import { NOMBRE_FORMATO, NOMBRE_PLAN } from "@/types/database";
import type { FormatoMenu, IntervaloCobro, MonedaCobro, NombrePlan, Plan } from "@/types/database";
import { slideUp } from "@/lib/animations";
import { cn } from "@/lib/utils";

const PLAN_RECOMENDADO: NombrePlan = "pro";

function Celda({ valor }: { valor: string | boolean }) {
  if (typeof valor === "boolean") {
    return valor ? (
      <Check className="mx-auto size-4 text-vm-success" aria-label="Sí" />
    ) : (
      <Minus className="mx-auto size-4 text-vm-border" aria-label="No" />
    );
  }
  return <span className="text-sm text-vm-ink">{valor}</span>;
}

function TarjetaPlan({
  plan,
  moneda,
  intervalo,
}: {
  plan: Plan;
  moneda: MonedaCobro;
  intervalo: IntervaloCobro;
}) {
  const nombre = plan.nombre as NombrePlan;
  const copy = PLANES_COPY[nombre];
  const esRecomendado = nombre === PLAN_RECOMENDADO;
  const precio = precioDelPlan(plan, moneda, intervalo);
  const esGratis = precio === 0;
  const ahorro = intervalo === "anual" ? porcentajeAhorroAnual(plan, moneda) : 0;

  const formatos = (plan.formatos_permitidos as FormatoMenu[])
    .map((f) => NOMBRE_FORMATO[f])
    .join(", ");

  return (
    <motion.article
      variants={slideUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border bg-white p-6",
        esRecomendado ? "border-2 border-vm-primary shadow-vm-2" : "shadow-vm-1",
      )}
    >
      {esRecomendado && (
        <>
          <BorderBeam
            size={90}
            duration={8}
            colorFrom="#2B4EFF"
            colorTo="#93a4ff"
            borderWidth={2}
          />
          <span className="absolute right-5 top-5 rounded-full bg-vm-primary px-2.5 py-1 text-xs font-medium text-white">
            Más popular
          </span>
        </>
      )}

      <h3 className="text-xl">{NOMBRE_PLAN[nombre]}</h3>
      <p className="mt-1 text-sm font-medium text-vm-primary">{copy.headline}</p>

      <p className="mt-6">
        <span className="vm-data text-4xl font-medium text-vm-ink">
          {esGratis ? formatearPrecio(0, moneda) : formatearPrecio(precio, moneda)}
        </span>
        <span className="ml-1.5 text-sm text-vm-body">
          {esGratis ? "para siempre" : intervalo === "anual" ? "/ año" : "/ mes"}
        </span>
      </p>
      {ahorro > 0 && (
        <p className="mt-1 text-xs font-medium text-vm-success">
          {PRECIOS.notaAhorroAnual(ahorro)}
        </p>
      )}

      <p className="mt-4 min-h-[4.5rem] text-sm leading-relaxed text-vm-body">{copy.descripcion}</p>

      <p className="mt-2 text-xs text-vm-body">
        <span className="font-medium text-vm-ink">Formatos:</span> {formatos}
      </p>

      {/* Enterprise dice "Contactar ventas" pero por ahora cae al mismo registro:
          no hay canal de ventas todavia (copywriting.md deja el WhatsApp por definir). */}
      <Link
        to="/registro"
        className={cn(
          "mt-6 inline-flex h-12 items-center justify-center rounded-lg text-sm font-medium transition-colors",
          esRecomendado
            ? "bg-vm-primary text-white hover:bg-vm-primary-hover"
            : "border text-vm-ink hover:bg-vm-bg-soft",
        )}
      >
        {copy.cta}
      </Link>
    </motion.article>
  );
}

function TablaComparativa({
  planes,
  titulo,
  soloDestacadas = false,
}: {
  planes: Plan[];
  titulo: string;
  soloDestacadas?: boolean;
}) {
  const grupos = gruposConFilas(soloDestacadas);
  return (
    <div className="mx-auto max-w-5xl overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 overflow-hidden rounded-xl border">
        <thead>
          <tr className="bg-vm-bg-soft">
            <th className="px-5 py-4 text-left text-sm font-medium text-vm-ink">{titulo}</th>
            {planes.map((p) => (
              <th key={p.id} className="px-5 py-4 text-center text-sm font-medium text-vm-ink">
                {NOMBRE_PLAN[p.nombre as NombrePlan]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <Fragment key={grupo}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={planes.length + 1}
                  className="border-t bg-vm-bg-soft/60 px-5 py-2.5 text-left text-xs font-medium tracking-wide text-vm-primary"
                >
                  {grupo.toUpperCase()}
                </th>
              </tr>
              {filasDeGrupo(grupo, soloDestacadas).map((fila: FilaComparativa) => (
                <tr key={fila.etiqueta}>
                  <th
                    scope="row"
                    className="border-t px-5 py-3.5 text-left text-sm font-normal text-vm-body"
                  >
                    {fila.etiqueta}
                  </th>
                  {planes.map((p) => (
                    <td key={p.id} className="border-t px-5 py-3.5 text-center">
                      <Celda valor={fila.valor(p)} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** `planesIniciales` los trae el loader de la ruta, para que existan en el SSR. */
export default function Precios({ planesIniciales }: { planesIniciales?: Plan[] }) {
  const [moneda, setMoneda] = useState<MonedaCobro>("mxn");
  const [intervalo, setIntervalo] = useState<IntervaloCobro>("mensual");
  const { data: planes, isLoading, isError } = usePlanes(planesIniciales);

  return (
    <Layout>
      <section className="px-4 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl text-balance md:text-5xl">
            Un plan para cada tamaño de negocio.
          </h1>
          <p className="mt-5 text-lg text-pretty text-vm-body">
            Empieza gratis y crece cuando lo necesites. Sin contratos, sin sorpresas.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <div
              role="group"
              aria-label="Moneda"
              className="inline-flex rounded-lg border bg-vm-bg-soft p-1"
            >
              {(["usd", "mxn"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoneda(m)}
                  aria-pressed={moneda === m}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                    moneda === m ? "bg-white text-vm-ink shadow-vm-1" : "text-vm-body",
                  )}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label="Periodo de cobro"
              className="inline-flex rounded-lg border bg-vm-bg-soft p-1"
            >
              {(["mensual", "anual"] as const).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIntervalo(i)}
                  aria-pressed={intervalo === i}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                    intervalo === i ? "bg-white text-vm-ink shadow-vm-1" : "text-vm-body",
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="mx-auto mt-14 grid max-w-7xl gap-6 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-96 animate-pulse rounded-xl border bg-vm-bg-soft" />
            ))}
          </div>
        )}

        {isError && (
          <p className="mt-14 text-center text-sm text-vm-danger">
            No pudimos cargar los planes. Vuelve a intentar en un momento.
          </p>
        )}

        {planes && (
          <>
            <div className="mx-auto mt-14 grid max-w-7xl items-stretch gap-6 md:grid-cols-2 lg:grid-cols-4">
              {planes.map((plan) => (
                <TarjetaPlan key={plan.id} plan={plan} moneda={moneda} intervalo={intervalo} />
              ))}
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-vm-body">
              {PRECIOS.notaPrecioCongelado}
            </p>

            <div className="mt-16">
              <TablaComparativa planes={planes} titulo="Comparación rápida" soloDestacadas />
            </div>

            <div className="mx-auto mt-20 max-w-5xl text-center">
              <h2 className="text-2xl md:text-3xl">{PRECIOS.comparativaCompletaTitulo}</h2>
              <p className="mt-3 text-sm text-vm-body">{PRECIOS.comparativaCompletaNota}</p>
            </div>
            <div className="mt-8">
              <TablaComparativa planes={planes} titulo="Comparar todo" />
            </div>
          </>
        )}
      </section>
    </Layout>
  );
}
