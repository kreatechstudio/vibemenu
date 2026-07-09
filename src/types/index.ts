/**
 * Los tipos de dominio viven en database.ts, generados desde el schema real.
 * Este archivo solo re-exporta, para no dejar dos fuentes de verdad.
 *
 * No volver a escribir interfaces a mano aqui: se desincronizan del schema.
 * La version anterior declaraba Horario.abre / Horario.cierra, cuando las
 * columnas reales son hora_apertura / hora_cierre; y a Tenant le faltaban
 * formatos_desbloqueados, igual que a Sucursal le faltaba timezone.
 */
export * from "./database";
