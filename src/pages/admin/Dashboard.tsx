import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, QrCode } from "lucide-react";
import AdminLayout, { nombreFormato } from "@/components/layout/AdminLayout";
import { NumberTicker } from "@/components/ui/number-ticker";
import { useTenantActual, useUsoDelTenant } from "@/hooks/useTenantActual";
import { fraccionDeUso, textoLimite } from "@/lib/plan";
import { NOMBRE_PLAN, type NombrePlan } from "@/types/database";
import { BOTONES } from "@/lib/copy";

function Metrica({
  label,
  valor,
  numerico,
}: {
  label: string;
  valor: string | number;
  numerico?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-vm-bg-soft p-5">
      <p className="text-[11px] font-medium tracking-wide text-vm-body">{label}</p>
      <p className="vm-data mt-2 text-2xl font-medium text-vm-ink">
        {numerico && typeof valor === "number" ? <NumberTicker value={valor} /> : valor}
      </p>
    </div>
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

  if (!ctx) return null;

  const { plan } = ctx;
  const productos = uso?.productos ?? 0;
  const sucursales = uso?.sucursales ?? 0;
  const fraccion = fraccionDeUso(plan.limite_productos, productos);

  return (
    <>
      <h1 className="text-2xl">Resumen de tu menú</h1>
      <p className="mt-1 text-sm text-vm-body">Todo lo que tu carta necesita, en un solo lugar.</p>

      {/* Sin métrica de escaneos ni de vistas: analytics está fuera de esta versión. */}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica label="TOTAL PRODUCTOS" valor={productos} numerico />
        <Metrica
          label="SUCURSALES"
          valor={
            plan.limite_sucursales === null
              ? String(sucursales)
              : `${sucursales} de ${plan.limite_sucursales}`
          }
        />
        <Metrica label="PLAN ACTUAL" valor={NOMBRE_PLAN[plan.nombre as NombrePlan]} />
        <Metrica label="FORMATO ACTIVO" valor={nombreFormato(ctx.tenant.formato_activo)} />
      </div>

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
