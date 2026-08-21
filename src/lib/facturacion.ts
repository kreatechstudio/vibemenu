/**
 * Preparación para CFDI real: todavía no hay PAC conectado (ver
 * src/docs/vibemenu_stripe.md, sección "Datos fiscales"), así que nada de
 * esto timbra una factura. Solo junta y valida los datos del negocio
 * receptor con las claves del catálogo SAT (c_RegimenFiscal / c_UsoCFDI).
 */

export const REGIMENES_FISCALES: { clave: string; etiqueta: string }[] = [
  { clave: "601", etiqueta: "601 — General de Ley Personas Morales" },
  { clave: "603", etiqueta: "603 — Personas Morales con Fines no Lucrativos" },
  { clave: "605", etiqueta: "605 — Sueldos y Salarios e Ingresos Asimilados a Salarios" },
  { clave: "606", etiqueta: "606 — Arrendamiento" },
  { clave: "607", etiqueta: "607 — Régimen de Enajenación o Adquisición de Bienes" },
  { clave: "608", etiqueta: "608 — Demás ingresos" },
  { clave: "610", etiqueta: "610 — Residentes en el Extranjero sin Establecimiento Permanente" },
  { clave: "611", etiqueta: "611 — Ingresos por Dividendos (socios y accionistas)" },
  {
    clave: "612",
    etiqueta: "612 — Personas Físicas con Actividades Empresariales y Profesionales",
  },
  { clave: "614", etiqueta: "614 — Ingresos por intereses" },
  { clave: "615", etiqueta: "615 — Régimen de los ingresos por obtención de premios" },
  { clave: "616", etiqueta: "616 — Sin obligaciones fiscales" },
  { clave: "620", etiqueta: "620 — Sociedades Cooperativas de Producción" },
  { clave: "621", etiqueta: "621 — Incorporación Fiscal" },
  { clave: "622", etiqueta: "622 — Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
  { clave: "623", etiqueta: "623 — Opcional para Grupos de Sociedades" },
  { clave: "624", etiqueta: "624 — Coordinados" },
  { clave: "625", etiqueta: "625 — Actividades Empresariales con Plataformas Tecnológicas" },
  { clave: "626", etiqueta: "626 — Régimen Simplificado de Confianza (RESICO)" },
];

/**
 * Recortado del catálogo SAT completo: fuera quedan las deducciones
 * personales (D01–D10, solo aplican a gastos médicos/escolares de personas
 * físicas) y nómina (CN01) — ninguna aplica a un negocio pagando software.
 */
export const USOS_CFDI: { clave: string; etiqueta: string }[] = [
  { clave: "G01", etiqueta: "G01 — Adquisición de mercancías" },
  { clave: "G02", etiqueta: "G02 — Devoluciones, descuentos o bonificaciones" },
  { clave: "G03", etiqueta: "G03 — Gastos en general" },
  { clave: "I01", etiqueta: "I01 — Construcciones" },
  { clave: "I02", etiqueta: "I02 — Mobiliario y equipo de oficina" },
  { clave: "I03", etiqueta: "I03 — Equipo de transporte" },
  { clave: "I04", etiqueta: "I04 — Equipo de cómputo y accesorios" },
  { clave: "I05", etiqueta: "I05 — Dados, troqueles, moldes y matrices" },
  { clave: "I06", etiqueta: "I06 — Comunicaciones telefónicas" },
  { clave: "I07", etiqueta: "I07 — Comunicaciones satelitales" },
  { clave: "I08", etiqueta: "I08 — Otra maquinaria y equipo" },
  { clave: "P01", etiqueta: "P01 — Por definir" },
  { clave: "S01", etiqueta: "S01 — Sin efectos fiscales" },
  { clave: "CP01", etiqueta: "CP01 — Pagos" },
];

// 3-4 letras (razón social o apellidos), 6 dígitos de fecha, 3 de homoclave.
const RFC_RE = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

export function rfcValido(rfc: string): boolean {
  return RFC_RE.test(rfc.trim().toUpperCase());
}

export function codigoPostalValido(cp: string): boolean {
  return /^[0-9]{5}$/.test(cp.trim());
}
