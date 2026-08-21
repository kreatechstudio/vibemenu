import { useEffect, useState } from "react";
import { ExternalLink, Info, Loader2 } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantActual } from "@/hooks/useTenantActual";
import { usePlanes } from "@/hooks/usePlanes";
import { useCheckout, usePortalStripe } from "@/hooks/useStripe";
import { trackEvent } from "@/lib/analytics";
import { suscripcionActiva, useHistorialSuscripciones } from "@/hooks/useSuscripciones";
import type { SuscripcionConPlan } from "@/hooks/useSuscripciones";
import { usePagos } from "@/hooks/usePagos";
import type { Pago } from "@/types/database";
import { formatearPrecio, precioDelPlan, textoLimite } from "@/lib/plan";
import { PRECIOS } from "@/lib/copy";
import {
  NOMBRE_PLAN,
  type EstadoSuscripcion,
  type MonedaCobro,
  type MotivoCambio,
  type NombrePlan,
} from "@/types/database";
import { cn } from "@/lib/utils";

export default function Suscripcion() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

const FECHA = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const fecha = (iso: string | null) => (iso ? FECHA.format(new Date(iso)) : "—");

const COLOR_ESTADO: Record<EstadoSuscripcion, string> = {
  activa: "bg-vm-success-soft text-vm-success",
  reemplazada: "bg-vm-bg-soft text-vm-body",
  cancelada: "bg-vm-danger-soft text-vm-danger",
  vencida: "bg-vm-warning-soft text-vm-warning",
};

const NOMBRE_ESTADO: Record<EstadoSuscripcion, string> = {
  activa: "Activa",
  reemplazada: "Reemplazada",
  cancelada: "Cancelada",
  vencida: "Vencida",
};

const NOMBRE_MOTIVO: Record<MotivoCambio, string> = {
  alta: "Alta",
  upgrade: "Upgrade",
  downgrade: "Downgrade",
  reactivacion: "Reactivación",
  cancelacion: "Cancelación",
  vencimiento: "Vencimiento",
};

function Historial({ filas, pagos }: { filas: SuscripcionConPlan[]; pagos: Pago[] }) {
  if (filas.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed p-8 text-center">
        <p className="text-sm text-vm-body">
          Todavía no tienes historial. Aparecerá aquí en cuanto contrates un plan de pago.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-vm-bg-soft text-left text-xs text-vm-body">
          <tr>
            <th className="px-4 py-3 font-medium">Plan</th>
            <th className="px-4 py-3 text-right font-medium">Precio</th>
            <th className="px-4 py-3 font-medium">Moneda</th>
            <th className="px-4 py-3 font-medium">Desde</th>
            <th className="px-4 py-3 font-medium">Hasta</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Motivo</th>
            <th className="px-4 py-3 font-medium">Recibo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((s) => {
            const moneda = s.moneda_cobro as MonedaCobro;
            const monto = moneda === "mxn" ? s.precio_congelado_mxn : s.precio_congelado_usd;
            const estado = s.estado as EstadoSuscripcion;

            return (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3.5 text-vm-ink">
                  {s.plan ? NOMBRE_PLAN[s.plan.nombre as NombrePlan] : "—"}
                </td>
                <td className="vm-data px-4 py-3.5 text-right text-vm-ink">
                  {formatearPrecio(monto, moneda)}
                </td>
                <td className="px-4 py-3.5 text-vm-body">{moneda.toUpperCase()}</td>
                <td className="px-4 py-3.5 text-vm-body">{fecha(s.fecha_inicio)}</td>
                <td className="px-4 py-3.5 text-vm-body">{fecha(s.fecha_fin)}</td>
                <td className="px-4 py-3.5">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      COLOR_ESTADO[estado],
                    )}
                  >
                    {NOMBRE_ESTADO[estado]}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-vm-body">
                  {NOMBRE_MOTIVO[s.motivo_cambio as MotivoCambio]}
                </td>
                <td className="px-4 py-3.5">
                  {(() => {
                    const pago = pagos.find((p) => p.suscripcion_id === s.id);
                    if (!pago?.stripe_hosted_invoice_url) {
                      return <span className="text-vm-body/60">—</span>;
                    }
                    return (
                      <a
                        href={pago.stripe_hosted_invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-vm-primary hover:underline"
                      >
                        Ver
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    );
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const { data: planes } = usePlanes();
  const { data: historial, isLoading } = useHistorialSuscripciones(
    ctx?.tenant.id,
    ctx?.esOwner ?? false,
  );
  const { data: pagos } = usePagos(ctx?.tenant.id, ctx?.esOwner ?? false);
  const checkout = useCheckout();
  const portal = usePortalStripe();
  // Dos errores separados: el de la comparativa no debe pintarse junto al botón
  // del portal, que está en otra sección. Antes parecía que fallaba el equivocado.
  const [errorPortal, setErrorPortal] = useState<string | null>(null);
  const [errorCheckout, setErrorCheckout] = useState<string | null>(null);

  // Stripe regresa aqui con ?checkout=ok tras un pago exitoso (ver success_url
  // en supabase/functions/crear-checkout). Se limpia el query param al leerlo
  // para no volver a contar la conversion si el dueno refresca la pagina.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "ok") return;
    trackEvent("purchase", { method: "stripe" });
    params.delete("checkout");
    const resto = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (resto ? `?${resto}` : ""));
  }, []);

  if (!ctx) return null;

  const { plan, tenant } = ctx;
  // En trial no existe ninguna fila en `suscripciones`: el precio es el de lista.
  const activa = suscripcionActiva(historial);

  const moneda: MonedaCobro = (activa?.moneda_cobro as MonedaCobro) ?? "mxn";
  const monto = activa
    ? moneda === "mxn"
      ? activa.precio_congelado_mxn
      : activa.precio_congelado_usd
    : precioDelPlan(plan, moneda);

  return (
    <>
      <h1 className="text-2xl">Suscripción</h1>
      <p className="mt-1 text-sm text-vm-body">Tu plan, tu precio y todo lo que has pagado.</p>

      {/* ── Plan actual ──────────────────────────────────── */}
      <section className="mt-7 rounded-xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl">{NOMBRE_PLAN[plan.nombre as NombrePlan]}</h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                  tenant.estado === "activo"
                    ? "bg-vm-success-soft text-vm-success"
                    : tenant.estado === "trial"
                      ? "bg-vm-warning-soft text-vm-warning"
                      : "bg-vm-danger-soft text-vm-danger",
                )}
              >
                {tenant.estado}
              </span>
            </div>

            <p className="mt-4">
              <span className="vm-data text-3xl font-medium text-vm-ink">
                {formatearPrecio(monto, moneda)}
              </span>
              <span className="ml-1.5 text-sm text-vm-body">
                {monto === 0 ? "para siempre" : "/ mes"}
              </span>
            </p>

            {activa ? (
              <>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-vm-body">
                  <Info className="size-3.5 shrink-0" aria-hidden />
                  Este es tu precio congelado. No sube mientras sigas activo.
                </p>
                {activa.fecha_renovacion && (
                  <p className="mt-1 text-xs text-vm-body">
                    Se renueva el {fecha(activa.fecha_renovacion)}.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 max-w-md text-xs text-vm-body">
                Estás en el plan gratuito. {PRECIOS.notaPrecioCongelado}
              </p>
            )}
          </div>

          <div className="text-sm text-vm-body">
            <ul className="space-y-1">
              <li>Sucursales: {textoLimite(plan.limite_sucursales)}</li>
              <li>Productos: {textoLimite(plan.limite_productos)}</li>
              <li>Usuarios: {textoLimite(plan.limite_usuarios)}</li>
              <li>Formatos: {textoLimite(plan.limite_formatos)}</li>
            </ul>
          </div>
        </div>

        {/* El portal de Stripe necesita un customer. En trial todavía no existe. */}
        <button
          type="button"
          disabled={!tenant.stripe_customer_id || portal.isPending}
          onClick={() => {
            setErrorPortal(null);
            portal.mutateAsync(tenant.id).catch((e: Error) => setErrorPortal(e.message));
          }}
          title={
            tenant.stripe_customer_id
              ? undefined
              : "Aún no tienes un plan de pago, así que no hay nada que administrar."
          }
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-vm-primary px-6 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {portal.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Administrar mi plan
          <ExternalLink className="size-4" aria-hidden />
        </button>

        {errorPortal && (
          <p className="mt-3 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
            {errorPortal}
          </p>
        )}
      </section>

      {/* ── Historial ────────────────────────────────────── */}
      <h2 className="mt-12 text-lg">Historial</h2>
      <p className="mt-1 text-sm text-vm-body">
        Una fila por periodo. El recibo es el comprobante de Stripe, no una factura fiscal.
      </p>
      {isLoading ? (
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-vm-bg-soft" />
      ) : (
        <Historial filas={historial ?? []} pagos={pagos ?? []} />
      )}

      {/* ── Comparativa ──────────────────────────────────── */}
      <h2 className="mt-12 text-lg">Cambiar de plan</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {planes?.map((p) => {
          const esActual = p.id === plan.id;
          // Sin stripe_price_id no hay checkout posible. El estado sale de la base.
          const sinStripe = !p.stripe_price_id_usd && !p.stripe_price_id_mxn && p.precio_usd > 0;

          return (
            <div
              key={p.id}
              className={cn(
                "rounded-xl border p-5",
                esActual && "border-2 border-vm-primary bg-vm-primary/5",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg">{NOMBRE_PLAN[p.nombre as NombrePlan]}</h3>
                {esActual && (
                  <span className="rounded-full bg-vm-primary px-2 py-0.5 text-[11px] font-medium text-white">
                    Actual
                  </span>
                )}
              </div>

              <p className="mt-3">
                <span className="vm-data text-2xl font-medium text-vm-ink">
                  {formatearPrecio(precioDelPlan(p, moneda), moneda)}
                </span>
                <span className="ml-1 text-xs text-vm-body">
                  {p.precio_usd === 0 ? "" : "/ mes"}
                </span>
              </p>

              <ul className="mt-4 space-y-1 text-xs text-vm-body">
                <li>{textoLimite(p.limite_sucursales)} sucursales</li>
                <li>{textoLimite(p.limite_productos)} productos</li>
                <li>{textoLimite(p.limite_formatos)} formatos</li>
              </ul>

              <button
                type="button"
                disabled={esActual || sinStripe || checkout.isPending}
                onClick={() => {
                  setErrorCheckout(null);
                  checkout
                    .mutateAsync({ tenantId: tenant.id, planId: p.id, moneda })
                    .catch((e: Error) => setErrorCheckout(e.message));
                }}
                title={sinStripe ? "Falta configurar Stripe para este plan." : undefined}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-xs font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkout.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {esActual ? "Tu plan actual" : "Cambiar a este plan"}
              </button>
            </div>
          );
        })}
      </div>

      {errorCheckout && (
        <p className="mt-4 rounded-lg bg-vm-danger-soft px-4 py-3 text-sm text-vm-danger">
          {errorCheckout}
        </p>
      )}

      {planes?.some((p) => p.precio_usd > 0 && !p.stripe_price_id_usd) && (
        <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-vm-warning-soft px-4 py-3 text-sm text-vm-warning">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Los planes de pago no tienen <code>stripe_price_id</code> en la base todavía. Hasta
          cargarlos, el checkout no puede abrirse.
        </p>
      )}
    </>
  );
}
