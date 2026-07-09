import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Categoria, Producto, TablesInsert } from "@/types/database";

/**
 * Lectura y escritura de la carta del tenant.
 *
 * Las RLS ya limitan la escritura a los miembros del tenant, y los triggers de
 * Postgres son los que bloquean de verdad los limites de plan. Aqui no se valida
 * ningun limite: se deja fallar y `traducirError` convierte el slug del trigger
 * en el copy correcto, con el numero real que trae `detail`.
 */

export function useCategorias(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["categorias", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("orden");
      if (error) throw error;
      return data;
    },
  });
}

export function useProductos(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["productos", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<Producto[]> => {
      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("orden");
      if (error) throw error;
      return data;
    },
  });
}

/** Invalida todo lo que depende de la carta, incluido el contador de uso del plan. */
function useInvalidarCarta(tenantId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["categorias", tenantId] });
    void qc.invalidateQueries({ queryKey: ["productos", tenantId] });
    void qc.invalidateQueries({ queryKey: ["uso-tenant", tenantId] });
  };
}

export function useCrearCategoria(tenantId: string | undefined) {
  const invalidar = useInvalidarCarta(tenantId);
  return useMutation({
    mutationFn: async ({ nombre, orden }: { nombre: string; orden: number }) => {
      const { error } = await supabase
        .from("categorias")
        .insert({ tenant_id: tenantId!, nombre, orden });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useRenombrarCategoria(tenantId: string | undefined) {
  const invalidar = useInvalidarCarta(tenantId);
  return useMutation({
    mutationFn: async ({ id, nombre }: { id: string; nombre: string }) => {
      const { error } = await supabase.from("categorias").update({ nombre }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useBorrarCategoria(tenantId: string | undefined) {
  const invalidar = useInvalidarCarta(tenantId);
  return useMutation({
    // on delete cascade en productos: borrar la categoria borra sus productos.
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export type BorradorProducto = Omit<TablesInsert<"productos">, "tenant_id">;

/** Devuelve el id del producto: al crear uno nuevo hace falta para vincular sus modificadores. */
export function useGuardarProducto(tenantId: string | undefined) {
  const invalidar = useInvalidarCarta(tenantId);
  return useMutation({
    mutationFn: async ({
      id,
      datos,
    }: {
      id?: string;
      datos: BorradorProducto;
    }): Promise<string> => {
      if (id) {
        const { error } = await supabase.from("productos").update(datos).eq("id", id);
        if (error) throw error;
        return id;
      }
      // El trigger trg_productos_30_limite rechaza el insert si el plan ya topo.
      const { data, error } = await supabase
        .from("productos")
        .insert({ ...datos, tenant_id: tenantId! })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidar,
  });
}

export function useBorrarProducto(tenantId: string | undefined) {
  const invalidar = useInvalidarCarta(tenantId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useAlternarActivo(tenantId: string | undefined) {
  const invalidar = useInvalidarCarta(tenantId);
  return useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase.from("productos").update({ activo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

const EXTENSIONES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

/**
 * Sube una imagen al bucket `vibemenu-media`.
 *
 * La ruta DEBE empezar por `{tenant_id}/`: la policy de storage.objects valida que
 * la primera carpeta sea un uuid y que el usuario pertenezca a ese tenant.
 */
export async function subirImagen(
  tenantId: string,
  archivo: File,
  carpeta: "productos" | "fondos" | "logos",
): Promise<string> {
  const ext = EXTENSIONES[archivo.type];
  if (!ext) throw new Error("formato_imagen_invalido");

  const ruta = `${tenantId}/${carpeta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("vibemenu-media")
    .upload(ruta, archivo, { cacheControl: "3600", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("vibemenu-media").getPublicUrl(ruta);
  return data.publicUrl;
}

export const subirFotoProducto = (tenantId: string, archivo: File) =>
  subirImagen(tenantId, archivo, "productos");
