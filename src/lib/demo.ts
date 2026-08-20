import type { CategoriaConProductos } from "@/hooks/useMenuPublico";
import type { Sucursal, Tenant } from "@/types/database";

/**
 * Datos ficticios de `/demo`. No tocan la base: la demo debe funcionar aunque
 * no exista ningun tenant registrado.
 *
 * Negocio realista, nunca "Restaurante 1" ni Lorem Ipsum (regla anti-generico).
 * Las fotos son de Unsplash y estan verificadas; sustituirlas por fotos propias
 * antes del lanzamiento.
 */

const foto = (id: string) => `https://images.unsplash.com/${id}?w=900&q=70&auto=format&fit=crop`;

export const TENANT_DEMO: Tenant = {
  id: "demo-tenant",
  nombre_negocio: "Tacos El Primo",
  slug: "tacos-el-primo",
  giro: "Taquería",
  descripcion: "Tacos al carbón y parrilladas desde 1998. Masa de maíz azul molida a diario.",
  logo_url: null,
  whatsapp: null,
  telefono: null,
  // La demo enseña los iconos de redes: es media pantalla de la cabecera.
  facebook_url: "https://facebook.com/tacoselprimo",
  instagram_url: "https://instagram.com/tacoselprimo",
  tiktok_url: "https://tiktok.com/@tacoselprimo",
  google_reviews_url: "https://maps.google.com/?cid=0",
  formato_activo: "pinterest",
  formatos_desbloqueados: ["clasico", "pinterest", "instagram", "tiktok"],
  tema: {
    color_primario: "#B91C1C",
    color_fondo: "#FFFBF5",
    color_texto: "#1C1917",
    color_texto_suave: "#57534E",
    tipografia: "serif",
  },
  plan_id: null,
  estado: "activo",
  trial_iniciado_at: new Date().toISOString(),
  stripe_customer_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const SUCURSAL_DEMO: Sucursal = {
  id: "demo-sucursal",
  tenant_id: "demo-tenant",
  nombre: "Centro",
  slug: "centro",
  direccion: "5 de Mayo 120, Centro Histórico",
  maps_url: null,
  telefono: null,
  whatsapp: null,
  timezone: "America/Mexico_City",
  activa: true,
  created_at: new Date().toISOString(),
};

const grupoTortilla = {
  id: "g-tortilla",
  tenant_id: "demo-tenant",
  nombre: "Tortilla",
  tipo_seleccion: "unica",
  obligatorio: true,
  min_selecciones: 1,
  max_selecciones: 1,
  orden: 0,
  opciones: [
    { id: "o-maiz", grupo_id: "g-tortilla", nombre: "Maíz", precio_extra: 0, orden: 0 },
    { id: "o-harina", grupo_id: "g-tortilla", nombre: "Harina", precio_extra: 4, orden: 1 },
  ],
};

const grupoExtras = {
  id: "g-extras",
  tenant_id: "demo-tenant",
  nombre: "Extras",
  tipo_seleccion: "multiple",
  obligatorio: false,
  min_selecciones: 0,
  max_selecciones: null,
  orden: 1,
  opciones: [
    { id: "o-queso", grupo_id: "g-extras", nombre: "Queso", precio_extra: 12, orden: 0 },
    { id: "o-aguacate", grupo_id: "g-extras", nombre: "Aguacate", precio_extra: 15, orden: 1 },
    { id: "o-cebolla", grupo_id: "g-extras", nombre: "Cebolla asada", precio_extra: 8, orden: 2 },
  ],
};

const base = {
  tenant_id: "demo-tenant",
  sucursal_id: null,
  activo: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  video_url: null,
};

export const CATEGORIAS_DEMO: CategoriaConProductos[] = [
  {
    id: "c-tacos",
    tenant_id: "demo-tenant",
    sucursal_id: null,
    nombre: "Tacos",
    orden: 0,
    created_at: new Date().toISOString(),
    productos: [
      {
        ...base,
        id: "p-pastor",
        categoria_id: "c-tacos",
        nombre: "Taco al Pastor",
        descripcion: "Cerdo marinado en achiote, piña asada, cilantro y cebolla.",
        precio: 28,
        imagen_url: foto("photo-1565299624946-b28f40a0ae38"),
        orden: 0,
        grupos: [grupoTortilla, grupoExtras],
      },
      {
        ...base,
        id: "p-suadero",
        categoria_id: "c-tacos",
        nombre: "Taco de Suadero",
        descripcion: "Res confitada a fuego lento, servida con salsa verde tatemada.",
        precio: 32,
        imagen_url: foto("photo-1551782450-a2132b4ba21d"),
        orden: 1,
        grupos: [grupoTortilla, grupoExtras],
      },
      {
        ...base,
        id: "p-campechano",
        categoria_id: "c-tacos",
        nombre: "Taco Campechano",
        descripcion: "Pastor y longaniza, la combinación de la casa.",
        precio: 35,
        imagen_url: foto("photo-1512621776951-a57141f2eefd"),
        orden: 2,
        grupos: [grupoTortilla],
      },
    ],
  },
  {
    id: "c-platos",
    tenant_id: "demo-tenant",
    sucursal_id: null,
    nombre: "Para compartir",
    orden: 1,
    created_at: new Date().toISOString(),
    productos: [
      {
        ...base,
        id: "p-parrillada",
        categoria_id: "c-platos",
        nombre: "Parrillada El Primo",
        descripcion: "Arrachera, pollo, chorizo, nopales y cebollitas. Para dos personas.",
        precio: 385,
        imagen_url: foto("photo-1414235077428-338989a2e8c0"),
        orden: 0,
        grupos: [grupoExtras],
      },
      {
        ...base,
        id: "p-guacamole",
        categoria_id: "c-platos",
        nombre: "Guacamole en Molcajete",
        descripcion: "Preparado al momento en tu mesa, con totopos de maíz azul.",
        precio: 145,
        imagen_url: foto("photo-1504674900247-0877df9cc836"),
        orden: 1,
        grupos: [],
      },
    ],
  },
  {
    id: "c-bebidas",
    tenant_id: "demo-tenant",
    sucursal_id: null,
    nombre: "Bebidas",
    orden: 2,
    created_at: new Date().toISOString(),
    productos: [
      {
        ...base,
        id: "p-agua",
        categoria_id: "c-bebidas",
        nombre: "Agua de Horchata",
        descripcion: "De la casa, con canela y un toque de vainilla.",
        precio: 45,
        imagen_url: foto("photo-1546069901-ba9599a7e63c"),
        orden: 0,
        grupos: [],
      },
      {
        ...base,
        id: "p-cafe",
        categoria_id: "c-bebidas",
        nombre: "Café de Olla",
        descripcion: "Piloncillo y canela, en jarrito de barro.",
        precio: 38,
        imagen_url: foto("photo-1509042239860-f550ce710b93"),
        orden: 1,
        grupos: [],
      },
      {
        ...base,
        id: "p-michelada",
        categoria_id: "c-bebidas",
        nombre: "Michelada Clásica",
        descripcion: "Limón, salsas y escarchado de chile en polvo.",
        precio: 85,
        imagen_url: foto("photo-1541167760496-1628856ab772"),
        orden: 2,
        grupos: [],
      },
    ],
  },
];
