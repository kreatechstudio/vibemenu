import { Link } from "@tanstack/react-router";
import { Bell, CalendarClock, MessageSquareWarning } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReservacionesNuevas } from "@/hooks/useReservaciones";
import { useOpinionesSinResolver } from "@/hooks/useOpiniones";

/**
 * Campana del header admin: cuenta reservaciones `nueva` + opiniones privadas
 * `!resuelto`. Sin estado propio de "leído" — el badge baja solo cuando el
 * dueño atiende cada cosa en su página (cambia el estado de la reservación, o
 * marca la opinión como resuelta), que es la misma acción que ya hacía antes.
 */
export default function CampanaNotificaciones({ tenantId }: { tenantId: string }) {
  const reservaciones = useReservacionesNuevas(tenantId);
  const opiniones = useOpinionesSinResolver(tenantId);

  const nReservaciones = reservaciones.data ?? 0;
  const nOpiniones = opiniones.data ?? 0;
  const total = nReservaciones + nOpiniones;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative grid size-10 shrink-0 place-items-center rounded-lg border text-vm-ink hover:bg-vm-bg-soft"
        aria-label={total > 0 ? `${total} notificaciones sin atender` : "Notificaciones"}
      >
        <Bell className="size-4" aria-hidden />
        {total > 0 && (
          <span
            className="vm-data absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-vm-danger px-1 text-[10px] font-semibold text-white"
            aria-hidden
          >
            {total > 9 ? "9+" : total}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
        {total === 0 ? (
          <p className="px-2 py-3 text-sm text-vm-body">Sin novedades por ahora.</p>
        ) : (
          <>
            {nReservaciones > 0 && (
              <DropdownMenuItem asChild>
                <Link to="/admin/reservaciones" className="gap-2.5">
                  <CalendarClock className="size-4 shrink-0 text-vm-primary" aria-hidden />
                  <span>
                    <span className="font-medium text-vm-ink">
                      {nReservaciones}{" "}
                      {nReservaciones === 1 ? "reservación nueva" : "reservaciones nuevas"}
                    </span>
                    <span className="block text-xs text-vm-body">Por confirmar o rechazar</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            )}
            {nOpiniones > 0 && (
              <DropdownMenuItem asChild>
                <Link to="/admin/opiniones" className="gap-2.5">
                  <MessageSquareWarning className="size-4 shrink-0 text-vm-primary" aria-hidden />
                  <span>
                    <span className="font-medium text-vm-ink">
                      {nOpiniones}{" "}
                      {nOpiniones === 1 ? "opinión sin resolver" : "opiniones sin resolver"}
                    </span>
                    <span className="block text-xs text-vm-body">
                      Comentarios privados de clientes
                    </span>
                  </span>
                </Link>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
