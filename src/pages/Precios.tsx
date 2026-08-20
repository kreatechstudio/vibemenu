import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { BorderBeam } from "@/components/ui/border-beam";
import { usePlanes } from "@/hooks/usePlanes";
import {
  formatearPrecio,
  fuentesDelPlan,
  modosImagenDelPlan,
  permiteColorModificadores,
  permiteDesenfoque,
  permiteQrAvanzado,
  permiteQrColor,
  precioDelPlan,
  textoLimite,
} from "@/lib/plan";
import { CLAVES_FUENTE } from "@/lib/fuentes";
import { PLANES_COPY, PRECIOS } from "@/lib/copy";
import { NOMBRE_FORMATO, NOMBRE_PLAN } from "@/types/database";
import type { FormatoMenu, MonedaCobro, NombrePlan, Plan } from "@/types/database";
import { slideUp } from "@/lib/animations";
import { cn } from "@/lib/utils";

const PLAN_RECOMENDADO: NombrePlan = "pro";

type Fila = { etiqueta: string; valor: (p: Plan) => string | boolean; grupo: string };

/**
 * Filas de la tabla comparativa. Cada una lee su valor de la fila de `planes`.
 * Nunca se hardcodea un límite: un `UPDATE` en la base cambia esta tabla sola.
 */
const CARACTERISTICAS: Fila[] = [
  { grupo: "Tu menú", etiqueta: "Sucursales", valor: (p) => textoLimite(p.limite_sucursales) },
  { grupo: "Tu menú", etiqueta: "Productos", valor: (p) => textoLimite(p.limite_productos) },
  {
    grupo: "Tu menú",
    etiqueta: "Grupos de modificadores",
    valor: (p) => textoLimite(p.limite_grupos_modificadores),
  },
  {
    grupo: "Tu menú",
    etiqueta: "Formatos",
    valor: (p) =>
      p.limite_formatos === null
        ? "Los 4"
        : p.limite_formatos === 1
          ? "Solo Clásico"
          : `Clásico + ${p.limite_formatos - 1} a elegir`,
  },
  {
    grupo: "Tu menú",
    etiqueta: "Menú y precios propios por sucursal",
    valor: (p) => p.menu_independiente_por_sucursal,
  },
  { grupo: "Tu menú", etiqueta: "Sin marca de agua", valor: (p) => !p.marca_agua },

  {
    grupo: "Diseño",
    etiqueta: "Tipografías",
    valor: (p) => `${fuentesDelPlan(p).length} de ${CLAVES_FUENTE.length}`,
  },
  { grupo: "Diseño", etiqueta: "Colores de la carta", valor: () => true },
  {
    grupo: "Diseño",
    etiqueta: "Color de los modificadores",
    valor: (p) => permiteColorModificadores(p),
  },
  {
    grupo: "Diseño",
    etiqueta: "Imagen de fondo",
    valor: (p) => {
      const modos = modosImagenDelPlan(p);
      if (modos.length === 0) return false;
      return modos.length === 1 ? "Modo marco" : "Marco y fondo completo";
    },
  },
  {
    grupo: "Diseño",
    etiqueta: "Desenfoque detrás del texto",
    valor: (p) => permiteDesenfoque(p),
  },

  {
    grupo: "Tu QR",
    etiqueta: "QR imprimible con tu nombre",
    valor: () => true,
  },
  {
    grupo: "Tu QR",
    etiqueta: "Los colores de tu menú",
    valor: (p) => permiteQrColor(p),
  },
  {
    grupo: "Tu QR",
    etiqueta: "Tu tipografía, tu logo y tu foto",
    valor: (p) => permiteQrAvanzado(p),
  },

  {
    grupo: "Tu equipo",
    etiqueta: "Usuarios del panel",
    valor: (p) => textoLimite(p.limite_usuarios),
  },
  { grupo: "Tu equipo", etiqueta: "Multi-usuario", valor: (p) => p.permite_multiusuario },
  { grupo: "Tu equipo", etiqueta: "Dominio propio", valor: (p) => p.permite_dominio_propio },
];

const GRUPOS = ["Tu menú", "Diseño", "Tu QR", "Tu equipo"] as const;

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

function TarjetaPlan({ plan, moneda }: { plan: Plan; moneda: MonedaCobro }) {
  const nombre = plan.nombre as NombrePlan;
  const copy = PLANES_COPY[nombre];
  const esRecomendado = nombre === PLAN_RECOMENDADO;
  const precio = precioDelPlan(plan, moneda);
  const esGratis = precio === 0;

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
        <span className="ml-1.5 text-sm text-vm-body">{esGratis ? "para siempre" : "/ mes"}</span>
      </p>

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

/** `planesIniciales` los trae el loader de la ruta, para que existan en el SSR. */
export default function Precios({ planesIniciales }: { planesIniciales?: Plan[] }) {
  const [moneda, setMoneda] = useState<MonedaCobro>("mxn");
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

            <div className="inline-flex items-center gap-2 rounded-lg border bg-vm-bg-soft p-1">
              <span className="rounded-md bg-white px-4 py-1.5 text-sm font-medium text-vm-ink shadow-vm-1">
                {PRECIOS.togglePeriodo}
              </span>
              <span
                className="cursor-not-allowed px-3 py-1.5 text-sm text-vm-body/60"
                title={PRECIOS.periodoAnualProximamente}
              >
                Anual
              </span>
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
                <TarjetaPlan key={plan.id} plan={plan} moneda={moneda} />
              ))}
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-vm-body">
              {PRECIOS.notaPrecioCongelado}
            </p>

            <div className="mx-auto mt-20 max-w-5xl overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 overflow-hidden rounded-xl border">
                <thead>
                  <tr className="bg-vm-bg-soft">
                    <th className="px-5 py-4 text-left text-sm font-medium text-vm-ink">
                      Comparar planes
                    </th>
                    {planes.map((p) => (
                      <th
                        key={p.id}
                        className="px-5 py-4 text-center text-sm font-medium text-vm-ink"
                      >
                        {NOMBRE_PLAN[p.nombre as NombrePlan]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GRUPOS.map((grupo) => (
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

                      {CARACTERISTICAS.filter((c) => c.grupo === grupo).map(
                        ({ etiqueta, valor }) => (
                          <tr key={etiqueta}>
                            <th
                              scope="row"
                              className="border-t px-5 py-3.5 text-left text-sm font-normal text-vm-body"
                            >
                              {etiqueta}
                            </th>
                            {planes.map((p) => (
                              <td key={p.id} className="border-t px-5 py-3.5 text-center">
                                <Celda valor={valor(p)} />
                              </td>
                            ))}
                          </tr>
                        ),
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </Layout>
  );
}
