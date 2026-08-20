import { Navigate } from "@tanstack/react-router";
import { ExternalLink, LogOut } from "lucide-react";
import Logo from "@/components/marca/Logo";
import { useSesion, cerrarSesion } from "@/hooks/useSesion";
import { useEsSuperAdmin, useTenantsSuperAdmin, nombrePlanDeTenant } from "@/hooks/useSuperAdmin";
import { formatearPrecio } from "@/lib/plan";
import { NOMBRE_PLAN, type MonedaCobro, type NombrePlan } from "@/types/database";
import { cn } from "@/lib/utils";

const FECHA = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

const COLOR_ESTADO: Record<string, string> = {
  trial: "bg-vm-warning-soft text-vm-warning",
  activo: "bg-vm-success-soft text-vm-success",
  suspendido: "bg-vm-danger-soft text-vm-danger",
  cancelado: "bg-vm-danger-soft text-vm-danger",
};

function Cargando() {
  return <div className="min-h-screen animate-pulse bg-vm-bg-soft" aria-busy="true" />;
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

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <p className="text-xs text-vm-body">Por plan</p>
            <p className="mt-2 text-sm text-vm-ink">
              {Object.entries(porPlan)
                .map(([plan, n]) => `${NOMBRE_PLAN[plan as NombrePlan]}: ${n}`)
                .join(" · ") || "—"}
            </p>
          </div>
        </div>

        {cargandoTenants ? (
          <div className="mt-6 h-64 animate-pulse rounded-xl bg-vm-bg-soft" />
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-vm-bg-soft text-left text-xs text-vm-body">
                <tr>
                  <th className="px-4 py-3 font-medium">Negocio</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Alta</th>
                  <th className="px-4 py-3 text-right font-medium">Suscripción activa</th>
                  <th className="px-4 py-3 font-medium">Renueva</th>
                </tr>
              </thead>
              <tbody>
                {(tenants ?? []).map((t) => {
                  const moneda = (t.suscripcionActiva?.moneda_cobro as MonedaCobro) ?? "mxn";
                  const monto = t.suscripcionActiva
                    ? moneda === "mxn"
                      ? t.suscripcionActiva.precio_congelado_mxn
                      : t.suscripcionActiva.precio_congelado_usd
                    : null;

                  return (
                    <tr key={t.id} className="border-t">
                      <td className="px-4 py-3.5">
                        <a
                          href={`/${t.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-vm-ink hover:text-vm-primary"
                        >
                          {t.nombre_negocio}
                          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                        </a>
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
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
