/** Compartido entre /superadmin y /superadmin/$tenantId. */

export const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export const FECHA_HORA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const COLOR_ESTADO: Record<string, string> = {
  trial: "bg-vm-warning-soft text-vm-warning",
  activo: "bg-vm-success-soft text-vm-success",
  suspendido: "bg-vm-danger-soft text-vm-danger",
  cancelado: "bg-vm-danger-soft text-vm-danger",
};

export const NOMBRE_ESTADO: Record<string, string> = {
  trial: "Trial",
  activo: "Activo",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
};

export type SituacionComercial =
  | { tipo: "pagando" }
  | { tipo: "pago_fallido"; desde: string }
  | { tipo: "suspendido" }
  | { tipo: "cancela_al_terminar"; hasta: string | null }
  | { tipo: "bajo"; desde: string | null }
  | { tipo: "trial" }
  | { tipo: "nunca_pago" };

/** Resumen mínimo de una fila de `suscripciones` que estas funciones necesitan. */
export type SuscripcionMin = {
  estado: string;
  fecha_fin: string | null;
  fecha_renovacion: string | null;
};

/** Días de la prueba de Pro. Igual que DIAS_TRIAL en supabase/functions/procesar-trials-vencidos. */
const DIAS_TRIAL = 14;
const MS_DIA = 86_400_000;

/**
 * Situación de cobro de un tenant, a partir de su historial de `suscripciones`.
 * Regla del webhook: una fila `estado='activa'` ⟺ está pagando ahora; un tenant
 * que nunca pagó no tiene ninguna fila. Ver el spec, sección "Ciclo de vida".
 */
export function situacionComercial(
  tenant: {
    estado: string;
    cancela_al_terminar: boolean | null;
    trial_iniciado_at: string | null;
    pago_fallido_desde: string | null;
  },
  suscripciones: readonly SuscripcionMin[],
  ahora: Date = new Date(),
): SituacionComercial {
  if (tenant.estado === "suspendido") return { tipo: "suspendido" };

  const activa = suscripciones.find((s) => s.estado === "activa");
  if (activa) {
    if (tenant.pago_fallido_desde) {
      return { tipo: "pago_fallido", desde: tenant.pago_fallido_desde };
    }
    return tenant.cancela_al_terminar
      ? { tipo: "cancela_al_terminar", hasta: activa.fecha_renovacion }
      : { tipo: "pagando" };
  }

  const canceladas = suscripciones.filter((s) => s.estado === "cancelada");
  if (canceladas.length > 0) {
    const desde =
      canceladas
        .map((s) => s.fecha_fin)
        .filter((f): f is string => Boolean(f))
        .sort()
        .at(-1) ?? null;
    return { tipo: "bajo", desde };
  }

  // Sin suscripción de pago nunca. `estado='trial'` es el default y el cron
  // NUNCA lo cambia (baja plan_id a Free y deja estado='trial'), así que hay
  // que mirar la fecha para saber si la prueba sigue viva.
  if (tenant.estado === "trial") {
    const dentroDeTrial =
      tenant.trial_iniciado_at === null ||
      ahora.getTime() - new Date(tenant.trial_iniciado_at).getTime() <= DIAS_TRIAL * MS_DIA;
    if (dentroDeTrial) return { tipo: "trial" };
  }
  return { tipo: "nunca_pago" };
}

/** ¿Se dio de baja dentro de los últimos `dias` días? Para el total "Bajas (30 d)". */
export function bajoEnUltimosDias(
  s: SituacionComercial,
  dias: number,
  ahora: Date = new Date(),
): boolean {
  if (s.tipo !== "bajo" || !s.desde) return false;
  const ms = ahora.getTime() - new Date(s.desde).getTime();
  return ms >= 0 && ms <= dias * 86_400_000;
}

export const ETIQUETA_SITUACION: Record<SituacionComercial["tipo"], string> = {
  pagando: "Pagando",
  pago_fallido: "Pago pendiente",
  suspendido: "Suspendido",
  cancela_al_terminar: "Cancela al terminar",
  bajo: "Bajó",
  trial: "En prueba",
  nunca_pago: "Nunca pagó",
};

/** Las 3 preguntas de `PasoMetricas.tsx`. Las respuestas "Otro" traen `${clave}_otro`. */
export const PREGUNTAS_ONBOARDING: { clave: string; etiqueta: string }[] = [
  { clave: "como_manejas_menu", etiqueta: "¿Cómo manejaba su menú?" },
  { clave: "dolor_principal", etiqueta: "Su mayor dolor de cabeza" },
  { clave: "como_nos_conociste", etiqueta: "Cómo nos conoció" },
];

export type Senal = { etiqueta: string; ok: boolean; detalle?: string };

/** Señales de enganche del tenant, para la ficha de super-admin. Pura. */
export function senalesDeSalud(input: {
  tenant: {
    created_at: string;
    lealtad_activa: boolean | null;
    formato_activo: string | null;
    logo_url: string | null;
    tema: unknown;
  };
  productos: number;
  algunaSucursalConReservas: boolean;
  visitas30: number | null;
  ahora?: Date;
}): Senal[] {
  const dias = Math.floor(
    ((input.ahora ?? new Date()).getTime() - new Date(input.tenant.created_at).getTime()) /
      86_400_000,
  );
  const temaTocado =
    !!input.tenant.tema &&
    typeof input.tenant.tema === "object" &&
    Object.keys(input.tenant.tema as object).length > 0;
  const formatoTocado = !!input.tenant.formato_activo && input.tenant.formato_activo !== "clasico";
  return [
    { etiqueta: "Publicó menú", ok: input.productos > 0, detalle: `${input.productos} productos` },
    {
      etiqueta: "Su menú recibe visitas",
      ok: (input.visitas30 ?? 0) > 0,
      detalle: `${input.visitas30 ?? 0} en 30 d`,
    },
    { etiqueta: "Personalizó diseño", ok: temaTocado || !!input.tenant.logo_url || formatoTocado },
    { etiqueta: "Activó tarjeta de lealtad", ok: !!input.tenant.lealtad_activa },
    { etiqueta: "Activó reservaciones", ok: input.algunaSucursalConReservas },
    { etiqueta: "Días desde el alta", ok: true, detalle: String(dias) },
  ];
}
