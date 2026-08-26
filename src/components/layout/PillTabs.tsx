import { Link, useLocation } from "@tanstack/react-router";
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

  return (
    <div className="tira-scroll -mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {pestanas.map((p) => {
        const activa = pathname === p.a;
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
          </Link>
        );
      })}
    </div>
  );
}
