import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Eye, Plus, QrCode, Store } from "lucide-react";
import AdminLayout, { nombreFormato } from "@/components/layout/AdminLayout";
import { NumberTicker } from "@/components/ui/number-ticker";
import { useTenantActual, useUsoDelTenant } from "@/hooks/useTenantActual";
import { useSucursales } from "@/hooks/useSucursales";
import { useVisitas, type ResumenVisitas } from "@/hooks/useVisitas";
import { fraccionDeUso, textoLimite } from "@/lib/plan";
import { NOMBRE_PLAN, type NombrePlan, type Sucursal } from "@/types/database";
import { BOTONES } from "@/lib/copy";

function Metrica({
  label,
  valor,
  numerico,
  nota,
}: {
  label: string;
  valor: string | number;
  numerico?: boolean;
  nota?: string;
}) {
  return (
    <div className="rounded-xl border bg-vm-bg-soft p-5">
      <p className="text-[11px] font-medium tracking-wide text-vm-body">{label}</p>
      <p className="vm-data mt-2 text-2xl font-medium text-vm-ink">
        {numerico && typeof valor === "number" ? <NumberTicker value={valor} /> : valor}
      </p>
      {nota && <p className="mt-1 text-xs text-vm-body">{nota}</p>}
    </div>
  );
}

/**
 * Reparto de visitas de los ultimos 30 dias. La barra es relativa al menu mas
 * visitado, no al total: con cinco sucursales, cinco barras del 20% no dicen nada.
 */
function VisitasPorSucursal({
  visitas,
  sucursales,
}: {
  visitas: ResumenVisitas;
  sucursales: Sucursal[];
}) {
  const filas = [
    { id: null as string | null, nombre: "Menú general" },
    ...sucursales.map((s) => ({ id: s.id as string | null, nombre: s.nombre })),
  ].map((f) => ({ ...f, visitas: visitas.porSucursal.get(f.id) ?? 0 }));

  const tope = Math.max(1, ...filas.map((f) => f.visitas));

  return (
    <section className="mt-8 rounded-xl border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-vm-ink">
          <Store className="size-3.5 text-vm-body" aria-hidden />
          Visitas por menú
        </p>
        <p className="text-xs text-vm-body">Últimos 30 días</p>
      </div>

      <ul className="mt-4 space-y-3">
        {filas.map((f) => (
          <li key={f.id ?? "general"}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-vm-ink">{f.nombre}</span>
              <span className="vm-data shrink-0 text-vm-body">{f.visitas}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-vm-bg-soft">
              <motion.div
                className="h-full rounded-full bg-vm-primary"
                initial={{ width: 0 }}
                animate={{ width: `${(f.visitas / tope) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </li>
        ))}
      </ul>

      {visitas.ultimos30 === 0 && (
        <p className="mt-4 text-xs text-vm-body">
          Todavía nadie ha abierto tu menú. Imprime tu QR y ponlo en las mesas.
        </p>
      )}
    </section>
  );
}

export default function Dashboard() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

function Contenido() {
  // AdminLayout ya garantizo que hay contexto antes de renderizar hijos.
  const { data: ctx } = useTenantActual();
  const { data: uso } = useUsoDelTenant(ctx?.tenant.id);
  const { data: sucursales } = useSucursales(ctx?.tenant.id);
  const { data: visitas, isError: sinVisitas } = useVisitas(ctx?.tenant.id);

  if (!ctx) return null;

  const { plan } = ctx;
  const productos = uso?.productos ?? 0;
  const totalSucursales = uso?.sucursales ?? 0;
  const fraccion = fraccionDeUso(plan.limite_productos, productos);

  return (
    <>
      <h1 className="text-2xl">Resumen de tu menú</h1>
      <p className="mt-1 text-sm text-vm-body">Todo lo que tu carta necesita, en un solo lugar.</p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metrica label="TOTAL PRODUCTOS" valor={productos} numerico />
        <Metrica
          label="SUCURSALES"
          valor={
            plan.limite_sucursales === null
              ? String(totalSucursales)
              : `${totalSucursales} de ${plan.limite_sucursales}`
          }
        />
        <Metrica label="PLAN ACTUAL" valor={NOMBRE_PLAN[plan.nombre as NombrePlan]} />

        <Metrica
          label="VISITAS HOY"
          valor={visitas?.hoy ?? 0}
          numerico
          nota="Una por comensal, no por recarga"
        />
        <Metrica label="ÚLTIMOS 7 DÍAS" valor={visitas?.ultimos7 ?? 0} numerico />
        <Metrica label="FORMATO ACTIVO" valor={nombreFormato(ctx.tenant.formato_activo)} />
      </div>

      {sinVisitas ? (
        <p className="mt-8 flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-vm-body">
          <Eye className="size-3.5 shrink-0" aria-hidden />
          No pudimos cargar las visitas por menú. Intenta de nuevo más tarde.
        </p>
      ) : (
        visitas && <VisitasPorSucursal visitas={visitas} sucursales={sucursales ?? []} />
      )}

      {fraccion !== null && (
        <section className="mt-8 rounded-xl border p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-vm-ink">Uso de tu plan</p>
            <p className="vm-data text-sm text-vm-body">
              {productos} / {textoLimite(plan.limite_productos)}
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-vm-bg-soft">
            <motion.div
              className="h-full rounded-full"
              style={{ background: fraccion > 0.9 ? "var(--vm-danger)" : "var(--vm-primary)" }}
              initial={{ width: 0 }}
              animate={{ width: `${fraccion * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          {fraccion >= 1 && (
            <p className="mt-3 text-sm text-vm-danger">
              Llegaste al límite de productos de tu plan actual.{" "}
              <Link to="/admin/suscripcion" className="font-medium underline">
                Actualiza tu plan
              </Link>{" "}
              para seguir agregando.
            </p>
          )}
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/admin/menu"
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white hover:bg-vm-primary-hover"
        >
          <Plus className="size-4" aria-hidden />
          {BOTONES.agregarProducto}
        </Link>
        <Link
          to="/admin/qr"
          className="inline-flex h-12 items-center gap-2 rounded-lg border px-5 text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
        >
          <QrCode className="size-4" aria-hidden />
          {BOTONES.descargarQR}
        </Link>
      </div>
    </>
  );
}
