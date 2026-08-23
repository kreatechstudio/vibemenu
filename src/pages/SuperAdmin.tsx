import { useState } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { ExternalLink, LogOut, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Logo from "@/components/marca/Logo";
import { useSesion, cerrarSesion } from "@/hooks/useSesion";
import { supabase } from "@/lib/supabase";
import {
  calcularMrr,
  nombrePlanDeTenant,
  useEsSuperAdmin,
  useTenantsSuperAdmin,
  type TenantSuperAdmin,
} from "@/hooks/useSuperAdmin";
import { formatearPrecio } from "@/lib/plan";
import { COLOR_ESTADO, FECHA } from "@/lib/superadmin";
import { avisarError } from "@/lib/avisos";
import {
  NOMBRE_PLAN,
  type EstadoTenant,
  type MonedaCobro,
  type NombrePlan,
} from "@/types/database";
import { cn } from "@/lib/utils";

const RECURSOS = [
  {
    nombre: "Vercel",
    desc: "Logs de runtime y errores de producción",
    href: "https://vercel.com/dashboard",
  },
  {
    nombre: "Supabase",
    desc: "Logs de base de datos y estado del webhook",
    href: "https://supabase.com/dashboard/project/iaiiwtqqiaqxnzxjqcnt/logs/explorer",
  },
  {
    nombre: "Stripe",
    desc: "Eventos de cobro y entregas del webhook",
    href: "https://dashboard.stripe.com/",
  },
] as const;

const FILTROS_ESTADO: { valor: EstadoTenant | "todos"; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "trial", etiqueta: "Trial" },
  { valor: "activo", etiqueta: "Activo" },
  { valor: "suspendido", etiqueta: "Suspendido" },
  { valor: "cancelado", etiqueta: "Cancelado" },
];

function Cargando() {
  return <div className="min-h-screen animate-pulse bg-vm-bg-soft" aria-busy="true" />;
}

function coincide(t: TenantSuperAdmin, busqueda: string): boolean {
  const q = busqueda.trim().toLowerCase();
  if (!q) return true;
  return t.nombre_negocio.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
}

/**
 * Panel interno de KreaTech. Guard propio en vez de AdminLayout: quien entra
 * aqui no necesariamente tiene un tenant propio. Sin sesion -> login; con
 * sesion pero sin fila en `super_admins` -> admin (nunca revela que existe
 * esta ruta a quien no deberia verla, mas alla del 404 normal de la app).
 */
export default function SuperAdmin() {
  const { user, cargando: cargandoSesion } = useSesion();
  const { data: esAdmin, isLoading: cargandoAdmin } = useEsSuperAdmin();
  const { data: tenants, isLoading: cargandoTenants } = useTenantsSuperAdmin(esAdmin === true);

  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoTenant | "todos">("todos");
  const [verificandoId, setVerificandoId] = useState<string | null>(null);

  async function verificarDominio(tenantId: string) {
    setVerificandoId(tenantId);
    try {
      const { error } = await supabase.functions.invoke("verificar-dominios-pendientes", {
        body: { tenant_id: tenantId },
      });
      if (error) {
        avisarError("No se pudo verificar el dominio. Intenta de nuevo.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["super-admin-tenants"] });
    } finally {
      setVerificandoId(null);
    }
  }

  if (cargandoSesion || cargandoAdmin) return <Cargando />;
  if (!user) return <Navigate to="/login" />;
  if (!esAdmin) return <Navigate to="/admin" />;

  const total = tenants?.length ?? 0;
  const porPlan = (tenants ?? []).reduce<Record<string, number>>((acc, t) => {
    const nombre = nombrePlanDeTenant(t);
    acc[nombre] = (acc[nombre] ?? 0) + 1;
    return acc;
  }, {});
  const activos = (tenants ?? []).filter((t) => t.estado === "activo").length;
  const enTrial = (tenants ?? []).filter((t) => t.estado === "trial").length;
  const mrr = calcularMrr(tenants ?? []);

  const visibles = (tenants ?? []).filter(
    (t) => coincide(t, busqueda) && (filtroEstado === "todos" || t.estado === filtroEstado),
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="flex h-16 items-center gap-3 border-b px-4 md:px-6">
        <Logo tamano="sm" />
        <span className="rounded-full bg-vm-primary/10 px-2.5 py-1 text-xs font-medium text-vm-primary">
          Super-admin
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="flex items-center gap-2 text-xs text-vm-body hover:text-vm-ink"
        >
          <LogOut className="size-3.5" aria-hidden />
          Cerrar sesión
        </button>
      </header>

      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <h1 className="text-2xl">Negocios en Vibemenu</h1>
        <p className="mt-1 text-sm text-vm-body">Vista interna, no visible para tenants.</p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border p-5">
            <p className="text-xs text-vm-body">Total de negocios</p>
            <p className="vm-data mt-2 text-2xl text-vm-ink">{total}</p>
          </div>
          <div className="rounded-xl border p-5">
            <p className="text-xs text-vm-body">Activos</p>
            <p className="vm-data mt-2 text-2xl text-vm-ink">{activos}</p>
          </div>
          <div className="rounded-xl border p-5">
            <p className="text-xs text-vm-body">En trial</p>
            <p className="vm-data mt-2 text-2xl text-vm-ink">{enTrial}</p>
          </div>
          <div className="rounded-xl border p-5">
            <p className="text-xs text-vm-body">Ingreso mensual recurrente</p>
            <p className="vm-data mt-2 text-2xl text-vm-ink">
              {mrr.mxn > 0 || mrr.usd === 0 ? formatearPrecio(mrr.mxn, "mxn") : null}
              {mrr.mxn > 0 && mrr.usd > 0 ? " + " : null}
              {mrr.usd > 0 ? formatearPrecio(mrr.usd, "usd") : null}
            </p>
          </div>
          <div className="rounded-xl border p-5">
            <p className="text-xs text-vm-body">Por plan</p>
            <p className="mt-2 text-sm text-vm-ink">
              {Object.entries(porPlan)
                .map(([plan, n]) => `${NOMBRE_PLAN[plan as NombrePlan]}: ${n}`)
                .join(" · ") || "—"}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-lg border px-3">
            <Search className="size-4 shrink-0 text-vm-body" aria-hidden />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o slug…"
              className="h-full w-full text-sm outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTROS_ESTADO.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltroEstado(f.valor)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  filtroEstado === f.valor
                    ? "bg-vm-primary text-white"
                    : "bg-vm-bg-soft text-vm-body hover:text-vm-ink",
                )}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>
        </div>

        {cargandoTenants ? (
          <div className="mt-4 h-64 animate-pulse rounded-xl bg-vm-bg-soft" />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-vm-bg-soft text-left text-xs text-vm-body">
                <tr>
                  <th className="px-4 py-3 font-medium">Negocio</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Alta</th>
                  <th className="px-4 py-3 font-medium">Dominio propio</th>
                  <th className="px-4 py-3 text-right font-medium">Suscripción activa</th>
                  <th className="px-4 py-3 font-medium">Renueva</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((t) => {
                  const moneda = (t.suscripcionActiva?.moneda_cobro as MonedaCobro) ?? "mxn";
                  const monto = t.suscripcionActiva
                    ? moneda === "mxn"
                      ? t.suscripcionActiva.precio_congelado_mxn
                      : t.suscripcionActiva.precio_congelado_usd
                    : null;

                  return (
                    <tr key={t.id} className="border-t">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Link
                            to="/superadmin/$tenantId"
                            params={{ tenantId: t.id }}
                            className="font-medium text-vm-ink hover:text-vm-primary"
                          >
                            {t.nombre_negocio}
                          </Link>
                          <a
                            href={`/${t.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Ver el menú de ${t.nombre_negocio}`}
                            className="text-vm-body hover:text-vm-primary"
                          >
                            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-vm-body">
                        {NOMBRE_PLAN[nombrePlanDeTenant(t)]}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                            COLOR_ESTADO[t.estado] ?? "bg-vm-bg-soft text-vm-body",
                          )}
                        >
                          {t.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-vm-body">
                        {FECHA.format(new Date(t.created_at))}
                      </td>
                      <td className="px-4 py-3.5">
                        {t.dominio_personalizado ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-medium",
                                t.dominio_estado === "verificado"
                                  ? "bg-vm-success-soft text-vm-success"
                                  : "bg-vm-warning-soft text-vm-warning",
                              )}
                            >
                              {t.dominio_personalizado}
                              {t.dominio_estado === "verificado" ? " · verificado" : " · pendiente"}
                            </span>
                            {t.dominio_estado !== "verificado" && (
                              <button
                                type="button"
                                onClick={() => void verificarDominio(t.id)}
                                disabled={verificandoId === t.id}
                                className="text-xs font-medium text-vm-primary hover:underline disabled:opacity-50"
                              >
                                {verificandoId === t.id ? "Revisando…" : "Verificar ahora"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-vm-body">—</span>
                        )}
                      </td>
                      <td className="vm-data px-4 py-3.5 text-right text-vm-ink">
                        {monto !== null ? formatearPrecio(monto, moneda) : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-vm-body">
                        {t.suscripcionActiva?.fecha_renovacion
                          ? FECHA.format(new Date(t.suscripcionActiva.fecha_renovacion))
                          : "—"}
                      </td>
                    </tr>
                  );
                })}

                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-vm-body">
                      Sin resultados para esa búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-medium text-vm-ink">Herramientas de debug</h2>
          <p className="mt-1 text-xs text-vm-body">
            No se reconstruyen aquí — cada una ya tiene su propio panel.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {RECURSOS.map((r) => (
              <a
                key={r.nombre}
                href={r.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border p-4 hover:border-vm-primary"
              >
                <p className="flex items-center gap-1.5 text-sm font-medium text-vm-ink">
                  {r.nombre}
                  <ExternalLink className="size-3.5 shrink-0 text-vm-body" aria-hidden />
                </p>
                <p className="mt-1 text-xs text-vm-body">{r.desc}</p>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
