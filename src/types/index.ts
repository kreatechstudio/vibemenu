export type FormatoMenu = "clasico" | "pinterest" | "instagram" | "tiktok";
export type EstadoTenant = "trial" | "activo" | "suspendido" | "cancelado";
export type RolUsuario = "owner" | "encargado";

export interface Tenant {
  id: string;
  nombre_negocio: string;
  slug: string;
  giro?: string | null;
  logo_url?: string | null;
  whatsapp?: string | null;
  telefono?: string | null;
  formato_activo: FormatoMenu;
  tema?: Record<string, unknown>;
  plan_id?: string | null;
  estado: EstadoTenant;
  trial_iniciado_at?: string;
  stripe_customer_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Sucursal {
  id: string;
  tenant_id: string;
  nombre: string;
  slug: string;
  direccion?: string | null;
  telefono?: string | null;
  activa: boolean;
}

export interface Horario {
  id: string;
  sucursal_id: string;
  dia_semana: number;
  abre: string;
  cierra: string;
}

export interface Categoria {
  id: string;
  tenant_id: string;
  nombre: string;
  orden: number;
}

export interface Producto {
  id: string;
  tenant_id: string;
  categoria_id: string;
  sucursal_id?: string | null;
  nombre: string;
  descripcion?: string | null;
  precio: number;
  imagen_url?: string | null;
  video_url?: string | null;
  disponible: boolean;
  orden: number;
}

export interface OpcionModificador {
  id: string;
  grupo_id: string;
  nombre: string;
  precio_extra: number;
}

export interface GrupoModificador {
  id: string;
  tenant_id: string;
  nombre: string;
  minimo: number;
  maximo: number;
  opciones?: OpcionModificador[];
}

export interface Plan {
  id: string;
  nombre: string;
  precio_usd: number;
  precio_mxn: number;
  max_sucursales: number;
  formatos_permitidos: FormatoMenu[];
  multi_usuario: boolean;
}

export interface Suscripcion {
  id: string;
  tenant_id: string;
  plan_id: string;
  stripe_subscription_id?: string | null;
  estado: string;
  moneda: "USD" | "MXN";
  inicia_at: string;
  renueva_at?: string | null;
}
