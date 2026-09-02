import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BarChart3, Lock } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs, { PESTANAS_NEGOCIO } from "@/components/layout/PillTabs";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useSucursales } from "@/hooks/useSucursales";
import { useAnaliticaProducto } from "@/hooks/useAnaliticaProducto";
import type { FilaRanking } from "@/lib/analitica";
import { cn } from "@/lib/utils";

export default function Analitica() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

/** Detrás del muro, difuminado. Nunca son datos reales. */
const EJEMPLO: FilaRanking[] = [
  {
    productoId: "00000000-0000-0000-0000-000000000001",
    nombre: "Tacos al pastor",
    vistas: 412,
    agregados: 173,
    tasa: 173 / 412,
  },
  {
    productoId: "00000000-0000-0000-0000-000000000002",
    nombre: "Pozole rojo",
    vistas: 268,
    agregados: 61,
    tasa: 61 / 268,
  },
  {
    productoId: "00000000-0000-0000-0000-000000000003",
    nombre: "Agua de horchata",
    vistas: 190,
    agregados: 88,
    tasa: 88 / 190,
  },
  {
    productoId: "00000000-0000-0000-0000-000000000004",
    nombre: "Flan napolitano",
    vistas: 47,
    agregados: 0,
    tasa: null,
  },
];

function textoTasa(tasa: number | null): string {
  return tasa === null ? "—" : `${Math.round(tasa * 100)}%`;
}

function FilaEjemplo({ f }: { f: FilaRanking }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border p-4 text-sm">
      <span className="min-w-0 truncate text-vm-ink">{f.nombre}</span>
      <span className="vm-data shrink-0 text-vm-body">
        {f.vistas} vistas · {f.agregados} agregados · {textoTasa(f.tasa)}
      </span>
    </li>
  );
}

function Bloqueado() {
  return (
    <div className="relative mt-8">
      <ul className="pointer-events-none space-y-3 select-none blur-sm" aria-hidden>
        {EJEMPLO.map((f) => (
          <FilaEjemplo key={f.productoId} f={f} />
        ))}
      </ul>
      <div className="absolute inset-0 grid place-items-center">
        <div className="max-w-sm rounded-xl border bg-white p-7 text-center shadow-vm-3">
          <Lock className="mx-auto size-8 text-vm-primary" aria-hidden />
          <h2 className="mt-4 text-xl">La analítica por platillo es parte de Enterprise.</h2>
          <p className="mt-2 text-sm text-vm-body">
            Descubre qué se ve y qué se pide más, a qué hora y en qué sucursal.
          </p>
          <Link
            to="/admin/suscripcion"
            className="mt-6 inline-flex h-12 items-center rounded-lg bg-vm-primary px-6 text-sm font-medium text-white hover:bg-vm-primary-hover"
          >
            Actualizar plan
          </Link>
        </div>
      </div>
    </div>
  );
}

type Columna = "vistas" | "agregados" | "tasa";

const fmtDia = (dia: string) =>
  new Date(`${dia}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

function Barra({ fraccion, tono = "primary" }: { fraccion: number; tono?: "primary" | "ink" }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-vm-bg-soft">
      <motion.div
        className={cn("h-full rounded-full", tono === "primary" ? "bg-vm-primary" : "bg-vm-ink")}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(1, fraccion)) * 100}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const tenantId = ctx?.tenant.id;
  const { data: sucursales } = useSucursales(tenantId);

  const [dias, setDias] = useState<7 | 30 | 90>(30);
  const [filtroSuc, setFiltroSuc] = useState<string | "todas">("todas");
  const [platilloSel, setPlatilloSel] = useState<string | null>(null);
  const [orden, setOrden] = useState<Columna | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, isError } = useAnaliticaProducto(tenantId, {
    dias,
    sucursalId: filtroSuc,
  });

  const rankingOrdenado = useMemo(() => {
    if (!data) return [];
    if (!orden) return data.ranking;
    const val = (f: FilaRanking) => (orden === "tasa" ? (f.tasa ?? -1) : f[orden]);
    return [...data.ranking].sort((a, b) => (dir === "asc" ? val(a) - val(b) : val(b) - val(a)));
  }, [data, orden, dir]);

  if (!ctx) return null;

  if (!ctx.plan.permite_analitica_platillo) {
    return (
      <>
        <PillTabs pestanas={PESTANAS_NEGOCIO} />
        <h1 className="text-2xl">Analítica por platillo</h1>
        <p className="mt-1 text-sm text-vm-body">
          Qué se ve y qué se pide en tu menú, platillo por platillo.
        </p>
        <Bloqueado />
      </>
    );
  }

  const ordenar = (col: Columna) => {
    if (orden === col) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrden(col);
      setDir("desc");
    }
  };
  const flecha = (col: Columna) => (orden === col ? (dir === "asc" ? " ↑" : " ↓") : "");

  const platilloActivo = platilloSel ?? data?.ranking[0]?.productoId ?? null;
  const horas = data && platilloActivo ? data.porHora(platilloActivo) : [];
  const topeHora = Math.max(1, ...horas.map((h) => h.vistas));

  const serie = data?.serie ?? [];
  const topeSerieV = Math.max(1, ...serie.map((s) => s.vistas));
  const topeSerieA = Math.max(1, ...serie.map((s) => s.agregados));
  const sumaVistas = serie.reduce((n, s) => n + s.vistas, 0);
  const sumaAgregados = serie.reduce((n, s) => n + s.agregados, 0);

  return (
    <>
      <PillTabs pestanas={PESTANAS_NEGOCIO} />
      <h1 className="text-2xl">Analítica por platillo</h1>
      <p className="mt-1 text-sm text-vm-body">
        Qué se ve y qué se pide en tu menú, platillo por platillo.
      </p>

      {isError && (
        <div className="mt-8 rounded-lg bg-vm-danger-soft px-4 py-3 text-sm text-vm-danger">
          <p>No pudimos leer tu analítica. Intenta recargar.</p>
          <p className="mt-1 text-xs opacity-80">
            Si acabas de instalar la función, quizá falte correr la migración{" "}
            <code>vibemenu_migracion_analitica_platillo.sql</code>.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {([7, 30, 90] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setDias(k)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              dias === k ? "bg-vm-primary text-white" : "bg-vm-bg-soft text-vm-body",
            )}
          >
            {k} días
          </button>
        ))}
        {(sucursales?.length ?? 0) > 1 && (
          <select
            value={filtroSuc}
            onChange={(e) => setFiltroSuc(e.target.value)}
            className="ml-auto h-8 rounded-full border px-3 text-xs"
          >
            <option value="todas">Todas las sucursales</option>
            {(sucursales ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && <div className="mt-8 h-40 animate-pulse rounded-xl bg-vm-bg-soft" />}

      {data && data.ranking.length === 0 && (
        <div className="mt-8 grid place-items-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <BarChart3 className="size-8 text-vm-body" aria-hidden />
          <p className="text-sm text-vm-body">
            Aún no hay suficientes datos. Comparte tu menú y vuelve en unos días.
          </p>
        </div>
      )}

      {data && data.ranking.length > 0 && (
        <div className="mt-8 space-y-10">
          {/* 1. Ranking */}
          <section>
            <h2 className="text-sm font-medium text-vm-ink">Ranking de platillos</h2>
            <p className="mt-1 text-xs text-vm-body">
              Ordena por la columna que te interese. La tasa es agregados ÷ vistas.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-vm-body">
                    <th className="py-2 pr-3 font-medium">Platillo</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      <button
                        type="button"
                        onClick={() => ordenar("vistas")}
                        className="hover:text-vm-ink"
                      >
                        Vistas{flecha("vistas")}
                      </button>
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">
                      <button
                        type="button"
                        onClick={() => ordenar("agregados")}
                        className="hover:text-vm-ink"
                      >
                        Agregados{flecha("agregados")}
                      </button>
                    </th>
                    <th className="py-2 text-right font-medium">
                      <button
                        type="button"
                        onClick={() => ordenar("tasa")}
                        className="hover:text-vm-ink"
                      >
                        Tasa{flecha("tasa")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rankingOrdenado.map((f) => (
                    <tr key={f.productoId} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-vm-ink">{f.nombre}</td>
                      <td className="vm-data py-2 pr-3 text-right text-vm-body">{f.vistas}</td>
                      <td className="vm-data py-2 pr-3 text-right text-vm-body">{f.agregados}</td>
                      <td className="vm-data py-2 text-right text-vm-body">{textoTasa(f.tasa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. Curva por hora */}
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-vm-ink">Curva por hora</h2>
              <select
                value={platilloActivo ?? ""}
                onChange={(e) => setPlatilloSel(e.target.value)}
                className="h-8 rounded-full border px-3 text-xs"
              >
                {data.ranking.map((f) => (
                  <option key={f.productoId} value={f.productoId}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-vm-body">
              A qué hora del día se mira este platillo (suma del rango).
            </p>
            <ul className="mt-3 space-y-1.5">
              {horas.map((h) => (
                <li key={h.hora} className="flex items-center gap-3 text-xs">
                  <span className="vm-data w-10 shrink-0 text-right text-vm-body">{h.hora}:00</span>
                  <div className="flex-1">
                    <Barra fraccion={h.vistas / topeHora} />
                  </div>
                  <span className="vm-data w-24 shrink-0 text-right text-vm-body">
                    {h.vistas} · {h.agregados} ag.
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* 3. Ignorados */}
          <section>
            <h2 className="text-sm font-medium text-vm-ink">Platillos ignorados</h2>
            <p className="mt-1 text-xs text-vm-body">
              Menos de 3 vistas en el rango. Revisa la foto y la descripción, o considera quitarlo.
            </p>
            {data.ignorados.length === 0 ? (
              <p className="mt-3 text-sm text-vm-body">
                Todos tus platillos activos tienen tracción. 👍
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.ignorados.map((i) => (
                  <li
                    key={i.productoId}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-vm-ink">{i.nombre}</span>
                    <span className="flex shrink-0 items-center gap-3 text-vm-body">
                      <span className="vm-data">
                        {i.vistas} {i.vistas === 1 ? "vista" : "vistas"}
                      </span>
                      <Link
                        to="/admin/menu"
                        className="font-medium text-vm-primary hover:underline"
                      >
                        editar
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 4. Tendencia diaria */}
          <section>
            <h2 className="text-sm font-medium text-vm-ink">Tendencia diaria</h2>
            <p className="mt-1 text-xs text-vm-body">
              Vistas y agregados por día en los últimos {dias} días.
            </p>

            <p className="mt-3 text-[11px] font-medium tracking-wide text-vm-body">VISTAS</p>
            <div className="mt-1 flex h-16 items-end gap-0.5">
              {serie.map((s) => (
                <motion.div
                  key={s.dia}
                  className="flex-1 rounded-sm bg-vm-primary"
                  title={`${fmtDia(s.dia)}: ${s.vistas} vistas`}
                  initial={{ height: 0 }}
                  animate={{ height: `${(s.vistas / topeSerieV) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              ))}
            </div>

            <p className="mt-3 text-[11px] font-medium tracking-wide text-vm-body">AGREGADOS</p>
            <div className="mt-1 flex h-10 items-end gap-0.5">
              {serie.map((s) => (
                <motion.div
                  key={s.dia}
                  className="flex-1 rounded-sm bg-vm-ink"
                  title={`${fmtDia(s.dia)}: ${s.agregados} agregados`}
                  initial={{ height: 0 }}
                  animate={{ height: `${(s.agregados / topeSerieA) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-vm-body">
              <span>
                {serie.length > 0 &&
                  `${fmtDia(serie[0].dia)} – ${fmtDia(serie[serie.length - 1].dia)}`}
              </span>
              <span className="vm-data">
                {sumaVistas} vistas · {sumaAgregados} agregados
              </span>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
