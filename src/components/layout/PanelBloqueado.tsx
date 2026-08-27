import { useState } from "react";
import { CreditCard, Loader2, LogOut } from "lucide-react";
import { usePortalStripe } from "@/hooks/useStripe";
import { cerrarSesion } from "@/hooks/useSesion";

/**
 * Pantalla que reemplaza al panel completo cuando el tenant quedo
 * `estado = 'suspendido'` -- pago fallido con el periodo de gracia ya vencido
 * (ver src/lib/gracia.ts y el cron procesar-trials-vencidos). El menu publico
 * del comensal sigue vivo; esto solo bloquea la administracion. Se sale por el
 * portal de Stripe (actualizar metodo de pago) o cerrando sesion.
 */
export default function PanelBloqueado({ tenantId }: { tenantId: string }) {
  const portal = usePortalStripe();
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="grid min-h-screen place-items-center bg-white px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-vm-danger-soft">
          <CreditCard className="size-7 text-vm-danger" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl text-vm-ink">Tu plan está suspendido</h1>
        <p className="mt-3 text-sm leading-relaxed text-vm-body">
          No pudimos cobrar tu suscripción y el periodo para regularizar ya venció. Tu menú público
          sigue en línea, pero la administración queda bloqueada hasta que actualices tu método de
          pago.
        </p>

        <button
          type="button"
          disabled={portal.isPending}
          onClick={() => {
            setError(null);
            portal.mutateAsync(tenantId).catch((e: Error) => setError(e.message));
          }}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:opacity-50"
        >
          {portal.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <CreditCard className="size-4" aria-hidden />
          )}
          Actualizar método de pago
        </button>

        {error && <p className="mt-3 text-sm text-vm-danger">{error}</p>}

        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="mt-4 inline-flex items-center gap-2 text-xs text-vm-body hover:text-vm-ink"
        >
          <LogOut className="size-3.5" aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
