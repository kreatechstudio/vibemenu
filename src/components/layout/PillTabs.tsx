import { Link, useLocation } from "@tanstack/react-router";
import { useReservacionesNuevas } from "@/hooks/useReservaciones";
import { useTenantActual } from "@/hooks/useTenantActual";
import { cn } from "@/lib/utils";

export type Pestana = {
  a: string;
  etiqueta: string;
};

/** Las pestañas de "Mi negocio": perfil, sucursales, equipo y facturación en un solo lugar. */
export const PESTANAS_NEGOCIO: Pestana[] = [
  { a: "/admin/empresa", etiqueta: "Perfil" },
  { a: "/admin/sucursales", etiqueta: "Sucursales" },
  { a: "/admin/equipo", etiqueta: "Equipo" },
  { a: "/admin/reservaciones", etiqueta: "Reservaciones" },
  { a: "/admin/opiniones", etiqueta: "Opiniones" },
  { a: "/admin/analitica", etiqueta: "Analítica" },
  { a: "/admin/lealtad", etiqueta: "Lealtad" },
  { a: "/admin/suscripcion", etiqueta: "Suscripción" },
];

/**
 * Sub-navegación en pills, para agrupar páginas relacionadas (p. ej. Mi carta +
 * Modificadores, o Mi negocio + Sucursales + Equipo) sin que cada una necesite
 * su propia entrada en el menú principal. Cada pestaña sigue siendo su propia
 * ruta — con su URL y su botón "atrás" — solo se navega sin salir del lugar.
 */
export default function PillTabs({ pestanas }: { pestanas: Pestana[] }) {
  const { pathname } = useLocation();
  const { data: ctx } = useTenantActual();
  const { data: nuevas = 0 } = useReservacionesNuevas(ctx?.tenant.id);

  return (
    <div className="tira-scroll -mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {pestanas.map((p) => {
        const activa = pathname === p.a;
        // Solo si el plan incluye reservaciones: si no, el badge apuntaría a
        // trabajo que el negocio no puede accionar detrás del muro de pago.
        const badge =
          p.a === "/admin/reservaciones" && nuevas > 0 && Boolean(ctx?.plan.permite_reservaciones);
        return (
          <Link
            key={p.a}
            to={p.a}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              activa
                ? "bg-vm-primary text-white"
                : "bg-vm-bg-soft text-vm-body hover:bg-vm-bg-soft/70 hover:text-vm-ink",
            )}
          >
            {p.etiqueta}
            {badge && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 text-[11px] font-semibold",
                  activa ? "bg-white text-vm-primary" : "bg-vm-primary text-white",
                )}
              >
                {nuevas}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
