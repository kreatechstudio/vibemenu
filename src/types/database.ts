export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
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
          {
            foreignKeyName: "categorias_sucursal_id_fkey";
            columns: ["sucursal_id"];
            isOneToOne: false;
            referencedRelation: "sucursales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categorias_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      datos_fiscales: {
        Row: {
          codigo_postal: string | null;
          email: string | null;
          razon_social: string | null;
          regimen_fiscal: string | null;
          rfc: string | null;
          tenant_id: string;
          updated_at: string;
          uso_cfdi: string | null;
        };
        Insert: {
          codigo_postal?: string | null;
          email?: string | null;
          razon_social?: string | null;
          regimen_fiscal?: string | null;
          rfc?: string | null;
          tenant_id: string;
          updated_at?: string;
          uso_cfdi?: string | null;
        };
        Update: {
          codigo_postal?: string | null;
          email?: string | null;
          razon_social?: string | null;
          regimen_fiscal?: string | null;
          rfc?: string | null;
          tenant_id?: string;
          updated_at?: string;
          uso_cfdi?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "datos_fiscales_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback_privado: {
        Row: {
          comentario: string | null;
          creado_at: string;
          id: number;
          resuelto: boolean;
          sentimiento: string;
          sucursal_id: string | null;
          tenant_id: string;
        };
        Insert: {
          comentario?: string | null;
          creado_at?: string;
          id?: never;
          resuelto?: boolean;
          sentimiento: string;
          sucursal_id?: string | null;
          tenant_id: string;
        };
        Update: {
          comentario?: string | null;
          creado_at?: string;
          id?: never;
          resuelto?: boolean;
          sentimiento?: string;
          sucursal_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_privado_sucursal_id_fkey";
            columns: ["sucursal_id"];
            isOneToOne: false;
            referencedRelation: "sucursales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_privado_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
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
        Relationships: [
          {
            foreignKeyName: "grupos_modificadores_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "horarios_sucursal_id_fkey";
            columns: ["sucursal_id"];
            isOneToOne: false;
            referencedRelation: "sucursales";
            referencedColumns: ["id"];
          },
        ];
      };
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
        Relationships: [
          {
            foreignKeyName: "invitaciones_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      notas_internas: {
        Row: {
          autor_id: string;
          created_at: string;
          id: string;
          tenant_id: string;
          texto: string;
        };
        Insert: {
          autor_id: string;
          created_at?: string;
          id?: string;
          tenant_id: string;
          texto: string;
        };
        Update: {
          autor_id?: string;
          created_at?: string;
          id?: string;
          tenant_id?: string;
          texto?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notas_internas_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      onboarding_respuestas: {
        Row: {
          created_at: string;
          id: string;
          respuestas: Json;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          respuestas?: Json;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          respuestas?: Json;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_respuestas_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      opciones_modificador: {
        Row: {
          grupo_id: string;
          id: string;
          nombre: string;
          orden: number;
          precio_extra: number;
        };
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
          {
            foreignKeyName: "opciones_modificador_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos_modificadores";
            referencedColumns: ["id"];
          },
        ];
      };
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
          {
            foreignKeyName: "pagos_suscripcion_id_fkey";
            columns: ["suscripcion_id"];
            isOneToOne: false;
            referencedRelation: "suscripciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      planes: {
        Row: {
          formatos_permitidos: string[];
          fuentes_permitidas: string[];
          id: string;
          limite_formatos: number | null;
          limite_grupos_modificadores: number | null;
          limite_productos: number | null;
          limite_sucursales: number | null;
          limite_usuarios: number | null;
          marca_agua: boolean;
          menu_independiente_por_sucursal: boolean;
          modos_imagen_permitidos: string[];
          nombre: string;
          permite_color_modificadores: boolean;
          permite_desenfoque: boolean;
          permite_dominio_propio: boolean;
          permite_embudo_resenas: boolean;
          permite_multiusuario: boolean;
          permite_pedidos_whatsapp: boolean;
          precio_mxn: number;
          precio_mxn_anual: number | null;
          precio_usd: number;
          precio_usd_anual: number | null;
          qr_avanzado: boolean;
          qr_color: boolean;
          stripe_price_id_mxn: string | null;
          stripe_price_id_mxn_anual: string | null;
          stripe_price_id_usd: string | null;
          stripe_price_id_usd_anual: string | null;
        };
        Insert: {
          formatos_permitidos?: string[];
          fuentes_permitidas?: string[];
          id?: string;
          limite_formatos?: number | null;
          limite_grupos_modificadores?: number | null;
          limite_productos?: number | null;
          limite_sucursales?: number | null;
          limite_usuarios?: number | null;
          marca_agua?: boolean;
          menu_independiente_por_sucursal?: boolean;
          modos_imagen_permitidos?: string[];
          nombre: string;
          permite_color_modificadores?: boolean;
          permite_desenfoque?: boolean;
          permite_dominio_propio?: boolean;
          permite_embudo_resenas?: boolean;
          permite_multiusuario?: boolean;
          permite_pedidos_whatsapp?: boolean;
          precio_mxn: number;
          precio_mxn_anual?: number | null;
          precio_usd: number;
          precio_usd_anual?: number | null;
          qr_avanzado?: boolean;
          qr_color?: boolean;
          stripe_price_id_mxn?: string | null;
          stripe_price_id_mxn_anual?: string | null;
          stripe_price_id_usd?: string | null;
          stripe_price_id_usd_anual?: string | null;
        };
        Update: {
          formatos_permitidos?: string[];
          fuentes_permitidas?: string[];
          id?: string;
          limite_formatos?: number | null;
          limite_grupos_modificadores?: number | null;
          limite_productos?: number | null;
          limite_sucursales?: number | null;
          limite_usuarios?: number | null;
          marca_agua?: boolean;
          menu_independiente_por_sucursal?: boolean;
          modos_imagen_permitidos?: string[];
          nombre?: string;
          permite_color_modificadores?: boolean;
          permite_desenfoque?: boolean;
          permite_dominio_propio?: boolean;
          permite_embudo_resenas?: boolean;
          permite_multiusuario?: boolean;
          permite_pedidos_whatsapp?: boolean;
          precio_mxn?: number;
          precio_mxn_anual?: number | null;
          precio_usd?: number;
          precio_usd_anual?: number | null;
          qr_avanzado?: boolean;
          qr_color?: boolean;
          stripe_price_id_mxn?: string | null;
          stripe_price_id_mxn_anual?: string | null;
          stripe_price_id_usd?: string | null;
          stripe_price_id_usd_anual?: string | null;
        };
        Relationships: [];
      };
      precios_sucursal: {
        Row: {
          created_at: string;
          precio: number;
          producto_id: string;
          sucursal_id: string;
        };
        Insert: {
          created_at?: string;
          precio: number;
          producto_id: string;
          sucursal_id: string;
        };
        Update: {
          created_at?: string;
          precio?: number;
          producto_id?: string;
          sucursal_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "precios_sucursal_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "precios_sucursal_sucursal_id_fkey";
            columns: ["sucursal_id"];
            isOneToOne: false;
            referencedRelation: "sucursales";
            referencedColumns: ["id"];
          },
        ];
      };
      producto_modificadores: {
        Row: {
          grupo_id: string;
          producto_id: string;
        };
        Insert: {
          grupo_id: string;
          producto_id: string;
        };
        Update: {
          grupo_id?: string;
          producto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "producto_modificadores_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos_modificadores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producto_modificadores_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
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
          {
            foreignKeyName: "productos_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "productos_sucursal_id_fkey";
            columns: ["sucursal_id"];
            isOneToOne: false;
            referencedRelation: "sucursales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "productos_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      slugs_reservados: {
        Row: {
          slug: string;
        };
        Insert: {
          slug: string;
        };
        Update: {
          slug?: string;
        };
        Relationships: [];
      };
      sucursales: {
        Row: {
          activa: boolean;
          created_at: string;
          direccion: string | null;
          google_reviews_url: string | null;
          id: string;
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
          google_reviews_url?: string | null;
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
          google_reviews_url?: string | null;
          id?: string;
          maps_url?: string | null;
          nombre?: string;
          slug?: string;
          telefono?: string | null;
          tenant_id?: string;
          timezone?: string;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sucursales_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      super_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
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
          {
            foreignKeyName: "suscripciones_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "planes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suscripciones_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_usuarios: {
        Row: {
          created_at: string;
          id: string;
          rol: string;
          tenant_id: string;
          user_id: string;
        };
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
        Relationships: [
          {
            foreignKeyName: "tenant_usuarios_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          aviso_trial_enviado_at: string | null;
          cancela_al_terminar: boolean;
          created_at: string;
          descripcion: string | null;
          dominio_asignado_at: string | null;
          dominio_aviso_error_at: string | null;
          dominio_diagnostico: Json | null;
          dominio_estado: string | null;
          dominio_personalizado: string | null;
          dominio_revocado_por_plan: boolean;
          estado: string;
          facebook_url: string | null;
          formato_activo: string;
          formatos_desbloqueados: string[];
          giro: string | null;
          google_reviews_url: string | null;
          id: string;
          instagram_url: string | null;
          logo_url: string | null;
          nombre_negocio: string;
          pago_fallido_desde: string | null;
          plan_id: string | null;
          slug: string;
          stripe_customer_id: string | null;
          telefono: string | null;
          tema: Json;
          tiktok_url: string | null;
          trial_iniciado_at: string;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          aviso_trial_enviado_at?: string | null;
          cancela_al_terminar?: boolean;
          created_at?: string;
          descripcion?: string | null;
          dominio_asignado_at?: string | null;
          dominio_aviso_error_at?: string | null;
          dominio_diagnostico?: Json | null;
          dominio_estado?: string | null;
          dominio_personalizado?: string | null;
          dominio_revocado_por_plan?: boolean;
          estado?: string;
          facebook_url?: string | null;
          formato_activo?: string;
          formatos_desbloqueados?: string[];
          giro?: string | null;
          google_reviews_url?: string | null;
          id?: string;
          instagram_url?: string | null;
          logo_url?: string | null;
          nombre_negocio: string;
          pago_fallido_desde?: string | null;
          plan_id?: string | null;
          slug: string;
          stripe_customer_id?: string | null;
          telefono?: string | null;
          tema?: Json;
          tiktok_url?: string | null;
          trial_iniciado_at?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          aviso_trial_enviado_at?: string | null;
          cancela_al_terminar?: boolean;
          created_at?: string;
          descripcion?: string | null;
          dominio_asignado_at?: string | null;
          dominio_aviso_error_at?: string | null;
          dominio_diagnostico?: Json | null;
          dominio_estado?: string | null;
          dominio_personalizado?: string | null;
          dominio_revocado_por_plan?: boolean;
          estado?: string;
          facebook_url?: string | null;
          formato_activo?: string;
          formatos_desbloqueados?: string[];
          giro?: string | null;
          google_reviews_url?: string | null;
          id?: string;
          instagram_url?: string | null;
          logo_url?: string | null;
          nombre_negocio?: string;
          pago_fallido_desde?: string | null;
          plan_id?: string | null;
          slug?: string;
          stripe_customer_id?: string | null;
          telefono?: string | null;
          tema?: Json;
          tiktok_url?: string | null;
          trial_iniciado_at?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenants_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "planes";
            referencedColumns: ["id"];
          },
        ];
      };
      visitas_menu: {
        Row: {
          dia: string;
          id: number;
          sucursal_id: string | null;
          tenant_id: string;
          visitas: number;
        };
        Insert: {
          dia: string;
          id?: never;
          sucursal_id?: string | null;
          tenant_id: string;
          visitas?: number;
        };
        Update: {
          dia?: string;
          id?: never;
          sucursal_id?: string | null;
          tenant_id?: string;
          visitas?: number;
        };
        Relationships: [
          {
            foreignKeyName: "visitas_menu_sucursal_id_fkey";
            columns: ["sucursal_id"];
            isOneToOne: false;
            referencedRelation: "sucursales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visitas_menu_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cambiar_estado_tenant: {
        Args: { p_estado: string; p_tenant_id: string };
        Returns: undefined;
      };
      equipo_del_tenant: {
        Args: { p_tenant_id: string };
        Returns: {
          avatar_url: string;
          created_at: string;
          email: string;
          nombre: string;
          rol: string;
          user_id: string;
        }[];
      };
      es_owner_de_tenant: {
        Args: { check_tenant_id: string };
        Returns: boolean;
      };
      es_super_admin: { Args: never; Returns: boolean };
      invitacion_info: {
        Args: { p_token: string };
        Returns: {
          cuenta_existente: boolean;
          email: string;
          estado: string;
          expira_at: string;
          tenant_nombre: string;
        }[];
      };
      normalizar_formatos: {
        Args: { p_formatos: string[]; p_limite: number; p_pool: string[] };
        Returns: string[];
      };
      pertenece_a_tenant: {
        Args: { check_tenant_id: string };
        Returns: boolean;
      };
      registrar_feedback: {
        Args: {
          p_comentario?: string;
          p_sentimiento: string;
          p_sucursal_id?: string;
          p_tenant_id: string;
        };
        Returns: undefined;
      };
      registrar_visita: {
        Args: { p_sucursal_id?: string; p_tenant_id: string };
        Returns: undefined;
      };
      sucursal_esta_abierta: {
        Args: { p_sucursal_id: string };
        Returns: boolean;
      };
      super_admin_equipo: {
        Args: { p_tenant_id: string };
        Returns: {
          avatar_url: string;
          created_at: string;
          email: string;
          nombre: string;
          rol: string;
          user_id: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

/* Aliases de dominio — tipos comunes para no escribir Tables<"..."> por todos lados. */
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
export type DatosFiscales = Tables<"datos_fiscales">;
export type SuperAdmin = Tables<"super_admins">;
export type Invitacion = Tables<"invitaciones">;
export type NotaInterna = Tables<"notas_internas">;

/* Uniones cerradas: el schema las guarda como text con CHECK. */
export type FormatoMenu = "clasico" | "pinterest" | "instagram" | "tiktok";
export type EstadoTenant = "trial" | "activo" | "suspendido" | "cancelado";
export type RolUsuario = "owner" | "encargado";
export type EstadoInvitacion = "pendiente" | "aceptada" | "cancelada";
export type NombrePlan = "free" | "basic" | "pro" | "enterprise";
export type MonedaCobro = "usd" | "mxn";
export type IntervaloCobro = "mensual" | "anual";
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
