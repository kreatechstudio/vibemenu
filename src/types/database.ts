/**
 * Tipos generados desde el schema real de Supabase (proyecto iaiiwtqqiaqxnzxjqcnt).
 * No editar a mano. Regenerar con:
 *   npx supabase gen types typescript --project-id iaiiwtqqiaqxnzxjqcnt > src/types/database.ts
 *
 * Los bloques `Relationships` no son decorativos: supabase-js los usa para tipar
 * los select anidados, p.ej. select("*, plan:planes(*)"). Si se borran, todo embed
 * pasa a ser SelectQueryError.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel<N extends string, C extends string, R extends string> = {
  foreignKeyName: N;
  columns: [C];
  isOneToOne: false;
  referencedRelation: R;
  referencedColumns: ["id"];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      categorias: {
        Row: {
          created_at: string;
          id: string;
          nombre: string;
          orden: number;
          sucursal_id: string | null;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nombre: string;
          orden?: number;
          sucursal_id?: string | null;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nombre?: string;
          orden?: number;
          sucursal_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          Rel<"categorias_sucursal_id_fkey", "sucursal_id", "sucursales">,
          Rel<"categorias_tenant_id_fkey", "tenant_id", "tenants">,
        ];
      };
      grupos_modificadores: {
        Row: {
          id: string;
          max_selecciones: number | null;
          min_selecciones: number;
          nombre: string;
          obligatorio: boolean;
          orden: number;
          tenant_id: string;
          tipo_seleccion: string;
        };
        Insert: {
          id?: string;
          max_selecciones?: number | null;
          min_selecciones?: number;
          nombre: string;
          obligatorio?: boolean;
          orden?: number;
          tenant_id: string;
          tipo_seleccion?: string;
        };
        Update: {
          id?: string;
          max_selecciones?: number | null;
          min_selecciones?: number;
          nombre?: string;
          obligatorio?: boolean;
          orden?: number;
          tenant_id?: string;
          tipo_seleccion?: string;
        };
        Relationships: [Rel<"grupos_modificadores_tenant_id_fkey", "tenant_id", "tenants">];
      };
      horarios: {
        Row: {
          cerrado: boolean;
          dia_semana: number;
          hora_apertura: string | null;
          hora_cierre: string | null;
          id: string;
          sucursal_id: string;
        };
        Insert: {
          cerrado?: boolean;
          dia_semana: number;
          hora_apertura?: string | null;
          hora_cierre?: string | null;
          id?: string;
          sucursal_id: string;
        };
        Update: {
          cerrado?: boolean;
          dia_semana?: number;
          hora_apertura?: string | null;
          hora_cierre?: string | null;
          id?: string;
          sucursal_id?: string;
        };
        Relationships: [Rel<"horarios_sucursal_id_fkey", "sucursal_id", "sucursales">];
      };
      /* Migración 012: invitaciones de equipo por correo. */
      invitaciones: {
        Row: {
          aceptada_at: string | null;
          created_at: string;
          email: string;
          estado: string;
          expira_at: string;
          id: string;
          invitado_por: string;
          tenant_id: string;
          token: string;
        };
        Insert: {
          aceptada_at?: string | null;
          created_at?: string;
          email: string;
          estado?: string;
          expira_at?: string;
          id?: string;
          invitado_por: string;
          tenant_id: string;
          token?: string;
        };
        Update: {
          aceptada_at?: string | null;
          created_at?: string;
          email?: string;
          estado?: string;
          expira_at?: string;
          id?: string;
          invitado_por?: string;
          tenant_id?: string;
          token?: string;
        };
        Relationships: [Rel<"invitaciones_tenant_id_fkey", "tenant_id", "tenants">];
      };
      opciones_modificador: {
        Row: { grupo_id: string; id: string; nombre: string; orden: number; precio_extra: number };
        Insert: {
          grupo_id: string;
          id?: string;
          nombre: string;
          orden?: number;
          precio_extra?: number;
        };
        Update: {
          grupo_id?: string;
          id?: string;
          nombre?: string;
          orden?: number;
          precio_extra?: number;
        };
        Relationships: [
          Rel<"opciones_modificador_grupo_id_fkey", "grupo_id", "grupos_modificadores">,
        ];
      };
      /* Migración 010 — verificada contra el schema real via MCP de Supabase. */
      pagos: {
        Row: {
          fecha_pago: string;
          id: string;
          moneda: string;
          monto: number;
          stripe_hosted_invoice_url: string | null;
          stripe_invoice_id: string;
          suscripcion_id: string | null;
          tenant_id: string;
        };
        Insert: {
          fecha_pago?: string;
          id?: string;
          moneda: string;
          monto: number;
          stripe_hosted_invoice_url?: string | null;
          stripe_invoice_id: string;
          suscripcion_id?: string | null;
          tenant_id: string;
        };
        Update: {
          fecha_pago?: string;
          id?: string;
          moneda?: string;
          monto?: number;
          stripe_hosted_invoice_url?: string | null;
          stripe_invoice_id?: string;
          suscripcion_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          Rel<"pagos_suscripcion_id_fkey", "suscripcion_id", "suscripciones">,
          Rel<"pagos_tenant_id_fkey", "tenant_id", "tenants">,
        ];
      };
      planes: {
        Row: {
          formatos_permitidos: string[];
          id: string;
          limite_formatos: number | null;
          limite_grupos_modificadores: number | null;
          limite_productos: number | null;
          limite_sucursales: number | null;
          limite_usuarios: number | null;
          marca_agua: boolean;
          menu_independiente_por_sucursal: boolean;
          nombre: string;
          permite_dominio_propio: boolean;
          permite_multiusuario: boolean;
          precio_mxn: number;
          precio_usd: number;
          stripe_price_id_mxn: string | null;
          stripe_price_id_usd: string | null;
          /* Migración 002 — personalización de tema por plan. */
          fuentes_permitidas: string[];
          permite_color_modificadores: boolean;
          modos_imagen_permitidos: string[];
          permite_desenfoque: boolean;
          /* Migración 005 — QR imprimible escalonado. */
          qr_color: boolean;
          qr_avanzado: boolean;
        };
        Insert: {
          formatos_permitidos?: string[];
          id?: string;
          limite_formatos?: number | null;
          limite_grupos_modificadores?: number | null;
          limite_productos?: number | null;
          limite_sucursales?: number | null;
          limite_usuarios?: number | null;
          marca_agua?: boolean;
          menu_independiente_por_sucursal?: boolean;
          nombre: string;
          permite_dominio_propio?: boolean;
          permite_multiusuario?: boolean;
          precio_mxn: number;
          precio_usd: number;
          stripe_price_id_mxn?: string | null;
          stripe_price_id_usd?: string | null;
          fuentes_permitidas?: string[];
          permite_color_modificadores?: boolean;
          modos_imagen_permitidos?: string[];
          permite_desenfoque?: boolean;
          qr_color?: boolean;
          qr_avanzado?: boolean;
        };
        Update: {
          formatos_permitidos?: string[];
          id?: string;
          limite_formatos?: number | null;
          limite_grupos_modificadores?: number | null;
          limite_productos?: number | null;
          limite_sucursales?: number | null;
          limite_usuarios?: number | null;
          marca_agua?: boolean;
          menu_independiente_por_sucursal?: boolean;
          nombre?: string;
          permite_dominio_propio?: boolean;
          permite_multiusuario?: boolean;
          precio_mxn?: number;
          precio_usd?: number;
          stripe_price_id_mxn?: string | null;
          stripe_price_id_usd?: string | null;
          fuentes_permitidas?: string[];
          permite_color_modificadores?: boolean;
          modos_imagen_permitidos?: string[];
          permite_desenfoque?: boolean;
        };
        Relationships: [];
      };
      /* Migración 005. Sin tenant_id: se deriva de `productos`. */
      precios_sucursal: {
        Row: { created_at: string; precio: number; producto_id: string; sucursal_id: string };
        Insert: { created_at?: string; precio: number; producto_id: string; sucursal_id: string };
        Update: {
          created_at?: string;
          precio?: number;
          producto_id?: string;
          sucursal_id?: string;
        };
        Relationships: [
          Rel<"precios_sucursal_producto_id_fkey", "producto_id", "productos">,
          Rel<"precios_sucursal_sucursal_id_fkey", "sucursal_id", "sucursales">,
        ];
      };
      producto_modificadores: {
        Row: { grupo_id: string; producto_id: string };
        Insert: { grupo_id: string; producto_id: string };
        Update: { grupo_id?: string; producto_id?: string };
        Relationships: [
          Rel<"producto_modificadores_grupo_id_fkey", "grupo_id", "grupos_modificadores">,
          Rel<"producto_modificadores_producto_id_fkey", "producto_id", "productos">,
        ];
      };
      productos: {
        Row: {
          activo: boolean;
          categoria_id: string;
          created_at: string;
          descripcion: string | null;
          id: string;
          imagen_url: string | null;
          nombre: string;
          orden: number;
          precio: number;
          sucursal_id: string | null;
          tenant_id: string;
          updated_at: string;
          video_url: string | null;
        };
        Insert: {
          activo?: boolean;
          categoria_id: string;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          imagen_url?: string | null;
          nombre: string;
          orden?: number;
          precio?: number;
          sucursal_id?: string | null;
          tenant_id: string;
          updated_at?: string;
          video_url?: string | null;
        };
        Update: {
          activo?: boolean;
          categoria_id?: string;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          imagen_url?: string | null;
          nombre?: string;
          orden?: number;
          precio?: number;
          sucursal_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
          video_url?: string | null;
        };
        Relationships: [
          Rel<"productos_categoria_id_fkey", "categoria_id", "categorias">,
          Rel<"productos_sucursal_id_fkey", "sucursal_id", "sucursales">,
          Rel<"productos_tenant_id_fkey", "tenant_id", "tenants">,
        ];
      };
      slugs_reservados: {
        Row: { slug: string };
        Insert: { slug: string };
        Update: { slug?: string };
        Relationships: [];
      };
      sucursales: {
        Row: {
          activa: boolean;
          created_at: string;
          direccion: string | null;
          id: string;
          /* Migración 004 */
          maps_url: string | null;
          nombre: string;
          slug: string;
          telefono: string | null;
          tenant_id: string;
          timezone: string;
          whatsapp: string | null;
        };
        Insert: {
          activa?: boolean;
          created_at?: string;
          direccion?: string | null;
          id?: string;
          maps_url?: string | null;
          nombre: string;
          slug: string;
          telefono?: string | null;
          tenant_id: string;
          timezone?: string;
          whatsapp?: string | null;
        };
        Update: {
          activa?: boolean;
          created_at?: string;
          direccion?: string | null;
          id?: string;
          maps_url?: string | null;
          nombre?: string;
          slug?: string;
          telefono?: string | null;
          tenant_id?: string;
          timezone?: string;
          whatsapp?: string | null;
        };
        Relationships: [Rel<"sucursales_tenant_id_fkey", "tenant_id", "tenants">];
      };
      /* Migración 009 — verificada contra el schema real via MCP de Supabase. */
      super_admins: {
        Row: { created_at: string; user_id: string };
        Insert: { created_at?: string; user_id: string };
        Update: { created_at?: string; user_id?: string };
        Relationships: [];
      };
      suscripciones: {
        Row: {
          created_at: string;
          estado: string;
          fecha_fin: string | null;
          fecha_inicio: string;
          fecha_renovacion: string | null;
          id: string;
          moneda_cobro: string;
          motivo_cambio: string;
          plan_id: string;
          precio_congelado_mxn: number;
          precio_congelado_usd: number;
          stripe_subscription_id: string | null;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          estado?: string;
          fecha_fin?: string | null;
          fecha_inicio?: string;
          fecha_renovacion?: string | null;
          id?: string;
          moneda_cobro?: string;
          motivo_cambio?: string;
          plan_id: string;
          precio_congelado_mxn: number;
          precio_congelado_usd: number;
          stripe_subscription_id?: string | null;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          estado?: string;
          fecha_fin?: string | null;
          fecha_inicio?: string;
          fecha_renovacion?: string | null;
          id?: string;
          moneda_cobro?: string;
          motivo_cambio?: string;
          plan_id?: string;
          precio_congelado_mxn?: number;
          precio_congelado_usd?: number;
          stripe_subscription_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          Rel<"suscripciones_plan_id_fkey", "plan_id", "planes">,
          Rel<"suscripciones_tenant_id_fkey", "tenant_id", "tenants">,
        ];
      };
      tenant_usuarios: {
        Row: { created_at: string; id: string; rol: string; tenant_id: string; user_id: string };
        Insert: {
          created_at?: string;
          id?: string;
          rol?: string;
          tenant_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          rol?: string;
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [Rel<"tenant_usuarios_tenant_id_fkey", "tenant_id", "tenants">];
      };
      tenants: {
        Row: {
          created_at: string;
          /* Migración 004 */
          descripcion: string | null;
          estado: string;
          formato_activo: string;
          formatos_desbloqueados: string[];
          giro: string | null;
          id: string;
          logo_url: string | null;
          nombre_negocio: string;
          plan_id: string | null;
          slug: string;
          stripe_customer_id: string | null;
          telefono: string | null;
          tema: Json;
          trial_iniciado_at: string;
          updated_at: string;
          whatsapp: string | null;
          /* Migración 007 — redes sociales del negocio. */
          facebook_url: string | null;
          instagram_url: string | null;
          tiktok_url: string | null;
          google_reviews_url: string | null;
        };
        Insert: {
          created_at?: string;
          descripcion?: string | null;
          estado?: string;
          formato_activo?: string;
          formatos_desbloqueados?: string[];
          giro?: string | null;
          id?: string;
          logo_url?: string | null;
          nombre_negocio: string;
          plan_id?: string | null;
          slug: string;
          stripe_customer_id?: string | null;
          telefono?: string | null;
          tema?: Json;
          trial_iniciado_at?: string;
          updated_at?: string;
          whatsapp?: string | null;
          facebook_url?: string | null;
          instagram_url?: string | null;
          tiktok_url?: string | null;
          google_reviews_url?: string | null;
        };
        Update: {
          created_at?: string;
          descripcion?: string | null;
          estado?: string;
          formato_activo?: string;
          formatos_desbloqueados?: string[];
          giro?: string | null;
          id?: string;
          logo_url?: string | null;
          nombre_negocio?: string;
          plan_id?: string | null;
          slug?: string;
          stripe_customer_id?: string | null;
          telefono?: string | null;
          tema?: Json;
          trial_iniciado_at?: string;
          updated_at?: string;
          whatsapp?: string | null;
          facebook_url?: string | null;
          instagram_url?: string | null;
          tiktok_url?: string | null;
          google_reviews_url?: string | null;
        };
        Relationships: [Rel<"tenants_plan_id_fkey", "plan_id", "planes">];
      };
      /* Migración 007. Un contador por (tenant, sucursal, día); `sucursal_id` null = menú general. */
      visitas_menu: {
        Row: {
          id: number;
          tenant_id: string;
          sucursal_id: string | null;
          dia: string;
          visitas: number;
        };
        Insert: {
          id?: number;
          tenant_id: string;
          sucursal_id?: string | null;
          dia: string;
          visitas?: number;
        };
        Update: {
          id?: number;
          tenant_id?: string;
          sucursal_id?: string | null;
          dia?: string;
          visitas?: number;
        };
        Relationships: [
          Rel<"visitas_menu_tenant_id_fkey", "tenant_id", "tenants">,
          Rel<"visitas_menu_sucursal_id_fkey", "sucursal_id", "sucursales">,
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      es_owner_de_tenant: { Args: { check_tenant_id: string }; Returns: boolean };
      /* Migración 012. SECURITY DEFINER, ejecutable por anon: el invitado aun puede no tener sesion. */
      invitacion_info: {
        Args: { p_token: string };
        Returns: {
          tenant_nombre: string;
          email: string;
          estado: string;
          expira_at: string;
          cuenta_existente: boolean;
        }[];
      };
      /* Migración 003. SECURITY DEFINER: solo devuelve el equipo del tenant de quien llama. */
      equipo_del_tenant: {
        Args: { p_tenant_id: string };
        Returns: { user_id: string; email: string; rol: string; created_at: string }[];
      };
      normalizar_formatos: {
        Args: { p_formatos: string[]; p_limite: number; p_pool: string[] };
        Returns: string[];
      };
      pertenece_a_tenant: { Args: { check_tenant_id: string }; Returns: boolean };
      /* Migración 007. La llama el menú público, sin sesión. */
      registrar_visita: {
        Args: { p_tenant_id: string; p_sucursal_id?: string | null };
        Returns: undefined;
      };
      sucursal_esta_abierta: { Args: { p_sucursal_id: string }; Returns: boolean };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

/* Aliases de dominio, para no escribir Tables<"..."> por todos lados. */
export type Plan = Tables<"planes">;
export type Tenant = Tables<"tenants">;
export type TenantUsuario = Tables<"tenant_usuarios">;
export type Sucursal = Tables<"sucursales">;
export type Horario = Tables<"horarios">;
export type Categoria = Tables<"categorias">;
export type Producto = Tables<"productos">;
export type PrecioSucursal = Tables<"precios_sucursal">;
export type GrupoModificador = Tables<"grupos_modificadores">;
export type OpcionModificador = Tables<"opciones_modificador">;
export type Suscripcion = Tables<"suscripciones">;
export type Pago = Tables<"pagos">;
export type SuperAdmin = Tables<"super_admins">;
export type Invitacion = Tables<"invitaciones">;

/* Uniones cerradas: el schema las guarda como text con CHECK. */
export type FormatoMenu = "clasico" | "pinterest" | "instagram" | "tiktok";
export type EstadoTenant = "trial" | "activo" | "suspendido" | "cancelado";
export type RolUsuario = "owner" | "encargado";
export type EstadoInvitacion = "pendiente" | "aceptada" | "cancelada";
export type NombrePlan = "free" | "basic" | "pro" | "enterprise";
export type MonedaCobro = "usd" | "mxn";
export type EstadoSuscripcion = "activa" | "cancelada" | "vencida" | "reemplazada";
export type MotivoCambio =
  | "alta"
  | "upgrade"
  | "downgrade"
  | "reactivacion"
  | "cancelacion"
  | "vencimiento";
export type TipoSeleccion = "unica" | "multiple";

export const FORMATOS: readonly FormatoMenu[] = ["clasico", "pinterest", "instagram", "tiktok"];

export const NOMBRE_FORMATO: Record<FormatoMenu, string> = {
  clasico: "Clásico",
  pinterest: "Pinterest",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export const NOMBRE_PLAN: Record<NombrePlan, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};
