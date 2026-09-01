/**
 * Datos de la empresa y proveedores citados en el Aviso de Privacidad y la política de Cookies.
 *
 * `domicilio` es a nivel ciudad/estado a propósito, no la calle: mientras no haya un apartado
 * postal u oficina virtual, publicar el domicilio particular de Carlos es un riesgo de
 * seguridad personal que no vale la pena. Cambialo por una dirección postal real en cuanto
 * la tengas — sigue siendo lo que recomienda la LFPDPPP para el aviso de privacidad.
 */
export const EMPRESA = {
  razonSocial: "KreaTech Studio",
  responsable: "Carlos López",
  dominio: "vibemenu.com.mx",
  correoContacto: "clopez@kreatechstudio.com.mx",
  correoPrivacidad: "privacidad@kreatechstudio.com.mx",
  domicilio: "Nuevo Laredo, Tamaulipas, México",
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
 * anunció pero aún no está en producción.
 *
 * La migración de imágenes a Cloudflare R2 se evaluó y se pausó (2026-08-20): con
 * la compresión de `src/lib/imagen.ts`, el uso real de Supabase Storage es de
 * kilobytes, no gigabytes — no hay urgencia de moverlas. Cloudflare se queda en
 * esta lista por Turnstile, que ya está en producción.
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
    rol: "Verificación de que no eres un bot (Turnstile) en el registro, el inicio de sesión, la recuperación de contraseña y el formulario de reservas del menú público",
    datos: "Señales técnicas del navegador, sin cookies publicitarias ni identidad",
    estado: "activo",
  },
  {
    nombre: "Resend",
    rol: "Correo transaccional: bienvenida, invitaciones de equipo y avisos de reserva al restaurante con los datos del comensal",
    datos:
      "Nombre, teléfono, correo y nota del comensal que solicita mesa; correo y nombre de los usuarios de la cuenta. Servidores en EE. UU.",
    estado: "activo",
  },
  {
    nombre: "Google Analytics",
    rol: "Estadísticas de tráfico y uso del sitio",
    datos:
      "Páginas visitadas, dispositivo, ubicación aproximada y cómo llegaste al sitio. No se envía tu nombre ni correo",
    estado: "activo",
  },
];
