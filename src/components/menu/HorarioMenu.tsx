import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useHorarios } from "@/hooks/useSucursales";
import { cn } from "@/lib/utils";

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Día de la semana (0 = domingo) visto desde la timezone de la sucursal, no la del navegador. */
function diaSemanaEnTz(tz: string): number {
  const abrev = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(
    new Date(),
  );
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return mapa[abrev] ?? new Date().getDay();
}

function formatearHora(hhmmss: string): string {
  const [h, m] = hhmmss.split(":").map(Number);
  const periodo = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${periodo}` : `${h12}:${String(m).padStart(2, "0")} ${periodo}`;
}

/**
 * El badge "Abierto"/"Cerrado ahora", ahora desplegable: al tocarlo muestra el
 * horario completo de la semana, con hoy resaltado. Los datos solo se piden
 * al abrir (`enabled: abierto`), no de entrada — la mayoría nunca lo toca.
 */
export default function HorarioMenu({
  sucursalId,
  timezone,
  abierta,
}: {
  sucursalId: string;
  timezone: string;
  abierta: boolean | undefined;
}) {
  const [abierto, setAbierto] = useState(false);
  const horarios = useHorarios(abierto ? sucursalId : undefined);
  const hoy = diaSemanaEnTz(timezone);

  if (abierta === undefined) {
    return <span className="h-6 w-20 animate-pulse rounded-full bg-black/10" aria-hidden />;
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label="Ver horario"
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80",
          abierta ? "bg-vm-success-soft text-vm-success" : "bg-vm-danger-soft text-vm-danger",
        )}
      >
        <span
          className={cn("size-1.5 rounded-full", abierta ? "bg-vm-success" : "bg-vm-danger")}
          aria-hidden
        />
        {abierta ? "Abierto" : "Cerrado ahora"}
        <ChevronDown className={cn("size-3 transition-transform", abierto && "rotate-180")} aria-hidden />
      </button>

      {abierto && (
        <div
          className="absolute right-0 z-10 mt-2 w-52 rounded-xl border p-3 text-xs shadow-vm-2"
          style={{
            background: "var(--menu-fondo)",
            color: "var(--menu-texto)",
            borderColor: "color-mix(in srgb, var(--menu-texto) 12%, transparent)",
          }}
        >
          {horarios.isLoading ? (
            <p style={{ color: "var(--menu-texto-suave)" }}>Cargando…</p>
          ) : (
            <ul className="space-y-1.5">
              {DIAS_CORTOS.map((nombre, dia) => {
                const fila = horarios.data?.find((h) => h.dia_semana === dia);
                const esHoy = dia === hoy;
                const texto =
                  !fila || fila.cerrado || !fila.hora_apertura || !fila.hora_cierre
                    ? "Cerrado"
                    : `${formatearHora(fila.hora_apertura)} – ${formatearHora(fila.hora_cierre)}`;
                return (
                  <li
                    key={dia}
                    className="flex items-center justify-between gap-3"
                    style={esHoy ? { color: "var(--menu-primario)", fontWeight: 600 } : undefined}
                  >
                    <span>{nombre}</span>
                    <span>{texto}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
