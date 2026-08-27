import { useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { ContextoTenant } from "@/hooks/useTenantActual";
import { useHistorialSuscripciones, suscripcionActiva } from "@/hooks/useSuscripciones";
import { usePortalStripe } from "@/hooks/useStripe";
import { fechaLimiteGracia } from "@/lib/gracia";

const FECHA = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "long", year: "numeric" });

/**
 * Barra de aviso de facturacion. Dos estados posibles, excluyentes:
 *  - Gracia por pago fallido (urgente): `pago_fallido_desde` con fecha y el
 *    tenant aun no suspendido. Cuenta regresiva a fechaLimiteGracia + boton al
 *    portal de Stripe. (Si ya esta suspendido, AdminLayout muestra
 *    <PanelBloqueado/> y este componente no llega a renderizar.)
 *  - Cancelacion programada (informativo): `cancela_al_terminar`. Dice cuando
 *    baja a Free. Sin CTA -- el tenant puede reactivar desde el portal si quiere.
 */
export default function BannerFacturacion({ ctx }: { ctx: ContextoTenant }) {
  const portal = usePortalStripe();
  const [error, setError] = useState<string | null>(null);
  const { data: historial } = useHistorialSuscripciones(ctx.tenant.id, ctx.esOwner);

  if (ctx.tenant.pago_fallido_desde) {
    const limite = FECHA.format(fechaLimiteGracia(ctx.tenant.pago_fallido_desde));
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-vm-danger/30 bg-vm-danger-soft px-4 py-2.5 text-sm text-vm-danger md:px-8">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          No pudimos cobrar tu plan. Regulariza antes del <strong>{limite}</strong> para no perder
          el acceso al panel.
        </span>
        <button
          type="button"
          disabled={portal.isPending}
          onClick={() => {
            setError(null);
            portal.mutateAsync(ctx.tenant.id).catch((e: Error) => setError(e.message));
          }}
          className="font-medium underline underline-offset-2 hover:no-underline disabled:opacity-50"
        >
          Actualizar método de pago
        </button>
        {error && <span className="w-full text-xs">{error}</span>}
      </div>
    );
  }

  if (ctx.tenant.cancela_al_terminar) {
    const activa = suscripcionActiva(historial ?? undefined);
    const cuando = activa?.fecha_renovacion
      ? FECHA.format(new Date(activa.fecha_renovacion))
      : "el fin de tu periodo";
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-vm-warning/30 bg-vm-warning-soft px-4 py-2.5 text-sm text-vm-warning md:px-8">
        <Info className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          Tu plan termina el <strong>{cuando}</strong>. Después tu menú baja a Free automáticamente,
          sin perder tu información.
        </span>
      </div>
    );
  }

  return null;
}
