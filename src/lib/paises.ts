/**
 * Lada de país para los campos de teléfono/WhatsApp del registro asistido.
 * Lista curada (no las ~195 del mundo) — LatAm + España + Norteamérica, los
 * mercados relevantes de Vibemenu. `tenants.telefono`/`whatsapp` siguen siendo
 * texto libre: esto solo ayuda a construir un valor bien formado desde el inicio.
 */
export type PaisLada = {
  pais: string;
  lada: string;
};

export const PAISES_LADA: PaisLada[] = [
  { pais: "México", lada: "+52" },
  { pais: "Estados Unidos", lada: "+1" },
  { pais: "Canadá", lada: "+1" },
  { pais: "Guatemala", lada: "+502" },
  { pais: "Belice", lada: "+501" },
  { pais: "El Salvador", lada: "+503" },
  { pais: "Honduras", lada: "+504" },
  { pais: "Nicaragua", lada: "+505" },
  { pais: "Costa Rica", lada: "+506" },
  { pais: "Panamá", lada: "+507" },
  { pais: "Colombia", lada: "+57" },
  { pais: "Venezuela", lada: "+58" },
  { pais: "Ecuador", lada: "+593" },
  { pais: "Perú", lada: "+51" },
  { pais: "Bolivia", lada: "+591" },
  { pais: "Chile", lada: "+56" },
  { pais: "Argentina", lada: "+54" },
  { pais: "Uruguay", lada: "+598" },
  { pais: "Paraguay", lada: "+595" },
  { pais: "República Dominicana", lada: "+1" },
  { pais: "Puerto Rico", lada: "+1" },
  { pais: "España", lada: "+34" },
];

export const LADA_DEFAULT = "+52";

/** Combina lada + número en un solo string para guardar en `tenants.telefono`/`whatsapp`. */
export function combinarTelefono(lada: string, numero: string): string | null {
  const limpio = numero.trim();
  if (!limpio) return null;
  return `${lada} ${limpio}`;
}
