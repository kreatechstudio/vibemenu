import { useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, Check, Loader2, X } from "lucide-react";
import Captcha, { captchaHabilitado, type TurnstileInstance } from "@/components/ui/captcha";
import PhoneInput from "@/components/ui/phone-input";
import { useCrearReservacion } from "@/hooks/useReservaciones";
import {
  formatearFechaHora,
  MAX_PERSONAS,
  validarReservacion,
  type BorradorReservacion,
} from "@/lib/reservaciones";
import type { Sucursal } from "@/types/database";

/** Sucursal a la que se reserva: la activa, o la única del negocio en el menú general. */
export function sucursalParaReservar(
  sucursalActiva: Sucursal | null,
  sucursales: Sucursal[],
): Sucursal | null {
  if (sucursalActiva) return sucursalActiva;
  return sucursales.length === 1 ? sucursales[0] : null;
}

/**
 * `YYYY-MM-DD` de una fecha vista desde `tz`. `en-CA` formatea justo así.
 * Se calcula en la timezone de la sucursal, no en UTC: al anochecer en México
 * la fecha UTC ya rodó a mañana y el date-picker rechazaría "esta noche"
 * aunque `validarReservacion` (que usa la hora de pared correcta) la acepte.
 */
const fechaEnTz = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);

const nuevoBorrador = (): BorradorReservacion => ({
  nombre: "",
  personas: 2,
  fecha: "",
  hora: "",
  telefono: "",
  email: "",
  nota: "",
  consentimiento: false,
});

export default function ReservarMenu({
  sucursalActiva,
  sucursales,
  habilitado,
}: {
  sucursalActiva: Sucursal | null;
  sucursales: Sucursal[];
  habilitado: boolean;
}) {
  const sucursal = useMemo(
    () => sucursalParaReservar(sucursalActiva, sucursales),
    [sucursalActiva, sucursales],
  );
  const [abierto, setAbierto] = useState(false);

  if (!habilitado || !sucursal?.acepta_reservaciones) return null;

  return (
    <div className="mx-auto -mt-2 max-w-2xl px-4 pb-8">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-opacity hover:opacity-75"
        style={{
          background: "color-mix(in srgb, var(--menu-primario) 10%, transparent)",
          color: "var(--menu-primario)",
        }}
      >
        <CalendarPlus className="size-4" aria-hidden />
        Reservar
      </button>

      <AnimatePresence>
        {abierto && (
          <FormularioReserva
            sucursalId={sucursal.id}
            tz={sucursal.timezone}
            alCerrar={() => setAbierto(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FormularioReserva({
  sucursalId,
  tz,
  alCerrar,
}: {
  sucursalId: string;
  tz: string;
  alCerrar: () => void;
}) {
  const [b, setB] = useState<BorradorReservacion>(nuevoBorrador);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const captchaRef = useRef<TurnstileInstance>(null);
  const crear = useCrearReservacion(sucursalId);

  // Límites del <input type="date">, en la timezone de la sucursal para que
  // cuadren con las reglas del servidor (`validarReservacion` / el trigger).
  const minFecha = useMemo(() => fechaEnTz(new Date(), tz), [tz]);
  const maxFecha = useMemo(() => fechaEnTz(new Date(Date.now() + 60 * 864e5), tz), [tz]);

  const set = <K extends keyof BorradorReservacion>(k: K, v: BorradorReservacion[K]) =>
    setB((prev) => ({ ...prev, [k]: v }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const problema = validarReservacion(b, new Date(), tz);
    if (problema) {
      setError(problema.motivo);
      return;
    }
    if (captchaHabilitado && !token) {
      setError("Espera a que cargue la verificación de seguridad.");
      return;
    }
    try {
      await crear.mutateAsync({ borrador: b, token });
      setListo(true);
    } catch (err) {
      setError((err as Error).message);
      captchaRef.current?.reset();
      setToken(null);
    }
  }

  const borde = "color-mix(in srgb, var(--menu-texto) 12%, transparent)";
  const campo =
    "mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[var(--menu-primario)]";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={alCerrar}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Reservar"
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl shadow-vm-3 sm:max-h-[88vh] sm:rounded-2xl"
        style={{ background: "var(--menu-fondo)", color: "var(--menu-texto)" }}
      >
        <div
          className="flex items-center justify-between border-b p-4"
          style={{ borderColor: borde }}
        >
          <h2 className="text-base font-semibold">Reservar</h2>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{ color: "var(--menu-texto-suave)" }}
          >
            <X className="size-5" />
          </button>
        </div>

        {listo ? (
          <div className="space-y-3 p-6 text-center">
            <Check className="mx-auto size-10 text-green-600" aria-hidden />
            <p className="text-sm">
              Recibimos tu solicitud. El restaurante te contactará al número que dejaste.
            </p>
            <button
              type="button"
              onClick={alCerrar}
              className="mt-2 inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium"
              style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
            >
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <label className="block text-sm">
              Nombre
              <input
                required
                value={b.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                className={campo}
                style={{ borderColor: borde, color: "var(--menu-texto)" }}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Personas
                <input
                  type="number"
                  min={1}
                  max={MAX_PERSONAS}
                  value={b.personas}
                  onChange={(e) => set("personas", Number(e.target.value))}
                  className={campo}
                  style={{ borderColor: borde, color: "var(--menu-texto)" }}
                />
              </label>
              <label className="block text-sm">
                Fecha
                <input
                  type="date"
                  required
                  min={minFecha}
                  max={maxFecha}
                  value={b.fecha}
                  onChange={(e) => set("fecha", e.target.value)}
                  className={campo}
                  style={{ borderColor: borde, color: "var(--menu-texto)" }}
                />
              </label>
            </div>

            <label className="block text-sm">
              Hora
              <input
                type="time"
                required
                value={b.hora}
                onChange={(e) => set("hora", e.target.value)}
                className={campo}
                style={{ borderColor: borde, color: "var(--menu-texto)" }}
              />
            </label>

            <div className="text-sm">
              <label htmlFor="reserva-telefono">Teléfono</label>
              <PhoneInput
                id="reserva-telefono"
                value={b.telefono}
                onChange={(v) => set("telefono", v)}
                placeholder="55 1234 5678"
              />
            </div>

            <label className="block text-sm">
              Correo <span style={{ color: "var(--menu-texto-suave)" }}>(opcional)</span>
              <input
                type="email"
                value={b.email}
                onChange={(e) => set("email", e.target.value)}
                className={campo}
                style={{ borderColor: borde, color: "var(--menu-texto)" }}
              />
            </label>

            <label className="block text-sm">
              Nota <span style={{ color: "var(--menu-texto-suave)" }}>(opcional)</span>
              <textarea
                value={b.nota}
                onChange={(e) => set("nota", e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Alergias, silla para bebé, festejo…"
                className={`${campo} resize-none`}
                style={{ borderColor: borde, color: "var(--menu-texto)" }}
              />
            </label>

            {b.fecha && b.hora && (
              <p className="text-xs" style={{ color: "var(--menu-texto-suave)" }}>
                Para el {formatearFechaHora(b.fecha, b.hora, tz)}.
              </p>
            )}

            <label
              className="flex items-start gap-2 text-xs"
              style={{ color: "var(--menu-texto-suave)" }}
            >
              <input
                type="checkbox"
                checked={b.consentimiento}
                onChange={(e) => set("consentimiento", e.target.checked)}
                className="mt-0.5 size-4"
                style={{ accentColor: "var(--menu-primario)" }}
              />
              <span>
                Acepto que mis datos se usen para gestionar mi reservación (
                <a href="/privacidad" target="_blank" rel="noreferrer" className="underline">
                  aviso de privacidad
                </a>
                ).
              </span>
            </label>

            <Captcha ref={captchaRef} onToken={setToken} />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={crear.isPending}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
            >
              {crear.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Enviar solicitud
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
