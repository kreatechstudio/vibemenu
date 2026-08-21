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
import { useDatosFiscales, useGuardarDatosFiscales } from "@/hooks/useDatosFiscales";
import type { DatosFiscales as DatosFiscalesTipo, Pago } from "@/types/database";
import { formatearPrecio, porcentajeAhorroAnual, precioDelPlan, textoLimite } from "@/lib/plan";
import { BOTONES, FACTURACION, PRECIOS } from "@/lib/copy";
import { codigoPostalValido, REGIMENES_FISCALES, rfcValido, USOS_CFDI } from "@/lib/facturacion";
import { traducirError } from "@/lib/errores";
import { avisarExito } from "@/lib/avisos";
import {
  NOMBRE_PLAN,
  type EstadoSuscripcion,
  type IntervaloCobro,
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

/** Como está en la constancia de situación fiscal: 12 caracteres persona moral, 13 física. */
function DatosFiscalesForm({
  tenantId,
  datos,
}: {
  tenantId: string;
  datos: DatosFiscalesTipo | null;
}) {
  const guardar = useGuardarDatosFiscales(tenantId);
  const [rfc, setRfc] = useState(datos?.rfc ?? "");
  const [razonSocial, setRazonSocial] = useState(datos?.razon_social ?? "");
  const [codigoPostal, setCodigoPostal] = useState(datos?.codigo_postal ?? "");
  const [regimenFiscal, setRegimenFiscal] = useState(datos?.regimen_fiscal ?? "");
  const [usoCfdi, setUsoCfdi] = useState(datos?.uso_cfdi ?? "");
  const [email, setEmail] = useState(datos?.email ?? "");
  const [error, setError] = useState<string | null>(null);

  async function alGuardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (rfc.trim() && !rfcValido(rfc)) {
      setError(FACTURACION.errorRfc);
      return;
    }
    if (codigoPostal.trim() && !codigoPostalValido(codigoPostal)) {
      setError(FACTURACION.errorCp);
      return;
    }

    try {
      await guardar.mutateAsync({
        rfc: rfc.trim() || null,
        razon_social: razonSocial.trim() || null,
        codigo_postal: codigoPostal.trim() || null,
        regimen_fiscal: regimenFiscal || null,
        uso_cfdi: usoCfdi || null,
        email: email.trim() || null,
      });
      avisarExito(FACTURACION.guardado);
    } catch (err) {
      setError(traducirError(err as Error).mensaje);
    }
  }

  return (
    <form onSubmit={alGuardar} className="mt-4 rounded-xl border p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="f-rfc" className="text-sm font-medium text-vm-ink">
            {FACTURACION.campos.rfc}
          </label>
          <input
            id="f-rfc"
            value={rfc}
            onChange={(e) => setRfc(e.target.value.toUpperCase())}
            placeholder="XAXX010101000"
            maxLength={13}
            className="mt-2 h-12 w-full rounded-lg border px-4 text-sm uppercase outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          />
        </div>

        <div>
          <label htmlFor="f-razon" className="text-sm font-medium text-vm-ink">
            {FACTURACION.campos.razonSocial}
          </label>
          <input
            id="f-razon"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            placeholder={FACTURACION.placeholderRazonSocial}
            className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          />
        </div>

        <div>
          <label htmlFor="f-cp" className="text-sm font-medium text-vm-ink">
            {FACTURACION.campos.codigoPostal}
          </label>
          <input
            id="f-cp"
            value={codigoPostal}
            onChange={(e) => setCodigoPostal(e.target.value)}
            placeholder="06000"
            maxLength={5}
            inputMode="numeric"
            className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          />
        </div>

        <div>
          <label htmlFor="f-email" className="text-sm font-medium text-vm-ink">
            {FACTURACION.campos.email}
          </label>
          <input
            id="f-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={FACTURACION.placeholderEmail}
            className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          />
        </div>

        <div>
          <label htmlFor="f-regimen" className="text-sm font-medium text-vm-ink">
            {FACTURACION.campos.regimenFiscal}
          </label>
          <select
            id="f-regimen"
            value={regimenFiscal}
            onChange={(e) => setRegimenFiscal(e.target.value)}
            className="mt-2 h-12 w-full rounded-lg border bg-white px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          >
            <option value="">{FACTURACION.seleccionar}</option>
            {REGIMENES_FISCALES.map((r) => (
              <option key={r.clave} value={r.clave}>
                {r.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-uso" className="text-sm font-medium text-vm-ink">
            {FACTURACION.campos.usoCfdi}
          </label>
          <select
            id="f-uso"
            value={usoCfdi}
            onChange={(e) => setUsoCfdi(e.target.value)}
            className="mt-2 h-12 w-full rounded-lg border bg-white px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          >
            <option value="">{FACTURACION.seleccionar}</option>
            {USOS_CFDI.map((u) => (
              <option key={u.clave} value={u.clave}>
                {u.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={guardar.isPending}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {guardar.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {BOTONES.guardarCambios}
      </button>
    </form>
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
  const { data: datosFiscales, isLoading: cargandoFiscales } = useDatosFiscales(
    ctx?.tenant.id,
    ctx?.esOwner ?? false,
  );
  const checkout = useCheckout();
  const portal = usePortalStripe();
  const [intervalo, setIntervalo] = useState<IntervaloCobro>("mensual");
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

      {/* ── Datos de facturación ─────────────────────────── */}
      <h2 className="mt-12 text-lg">{FACTURACION.titulo}</h2>
      <p className="mt-1 max-w-prose text-sm text-vm-body">{FACTURACION.nota}</p>
      {cargandoFiscales ? (
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-vm-bg-soft" />
      ) : (
        <DatosFiscalesForm key={tenant.id} tenantId={tenant.id} datos={datosFiscales ?? null} />
      )}

      {/* ── Comparativa ──────────────────────────────────── */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Cambiar de plan</h2>
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
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {planes?.map((p) => {
          const esActual = p.id === plan.id;
          const idStripe =
            intervalo === "anual"
              ? moneda === "mxn"
                ? p.stripe_price_id_mxn_anual
                : p.stripe_price_id_usd_anual
              : moneda === "mxn"
                ? p.stripe_price_id_mxn
                : p.stripe_price_id_usd;
          // Sin stripe_price_id no hay checkout posible. El estado sale de la base.
          const sinStripe = !idStripe && p.precio_usd > 0;
          const ahorro = intervalo === "anual" ? porcentajeAhorroAnual(p, moneda) : 0;

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
                  {formatearPrecio(precioDelPlan(p, moneda, intervalo), moneda)}
                </span>
                <span className="ml-1 text-xs text-vm-body">
                  {p.precio_usd === 0 ? "" : intervalo === "anual" ? "/ año" : "/ mes"}
                </span>
              </p>
              {ahorro > 0 && (
                <p className="mt-1 text-xs font-medium text-vm-success">
                  {PRECIOS.notaAhorroAnual(ahorro)}
                </p>
              )}

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
                    .mutateAsync({ tenantId: tenant.id, planId: p.id, moneda, intervalo })
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
