/**
 * Datos de la empresa y proveedores citados en el Aviso de Privacidad y la política de Cookies.
 *
 * El domicilio fiscal es un marcador de posición: LFPDPPP exige un domicilio real en el
 * aviso de privacidad. Sustitúyelo antes de publicar estas páginas.
 */
export const EMPRESA = {
  razonSocial: "KreaTech Studio",
  responsable: "Carlos López",
  dominio: "vibemenu.com",
  correoContacto: "hola@vibemenu.com",
  correoPrivacidad: "privacidad@vibemenu.com",
  domicilio: "[Domicilio fiscal de KreaTech Studio — completar antes de publicar]",
} as const;

/** Misma fecha en los tres documentos: si cambia uno, cambian todos. */
export const VIGENCIA_LEGAL = "20 de agosto de 2026";

export type Proveedor = {
  nombre: string;
  rol: string;
  datos: string;
  estado?: "activo" | "en migración";
};

/**
 * Subprocesadores reales del stack. `estado: "en migración"` marca lo que Carlos
 * anunció pero aún no está en producción (Cloudflare R2 y Turnstile) — se listan porque
 * el aviso de privacidad debe anticiparse a la migración, no reaccionar después.
 */
export const PROVEEDORES: Proveedor[] = [
  {
    nombre: "Supabase",
    rol: "Base de datos, autenticación y almacenamiento de imágenes",
    datos: "Datos de cuenta, contenido del menú, imágenes de producto",
    estado: "activo",
  },
  {
    nombre: "Stripe",
    rol: "Procesamiento de pagos y facturación recurrente",
    datos: "Datos de facturación. Vibemenu nunca recibe ni almacena tu número de tarjeta completo",
    estado: "activo",
  },
  {
    nombre: "Google",
    rol: "Inicio de sesión con Google (opcional) y tipografías de la interfaz",
    datos:
      "Correo y nombre de perfil si inicias sesión con Google. Las tipografías no asocian datos personales",
    estado: "activo",
  },
  {
    nombre: "Cloudflare",
    rol: "Almacenamiento y entrega de imágenes (R2), y verificación de que no eres un bot (Turnstile) en el registro",
    datos:
      "Imágenes de producto; en Turnstile, señales técnicas del navegador sin cookies publicitarias",
    estado: "en migración",
  },
];
