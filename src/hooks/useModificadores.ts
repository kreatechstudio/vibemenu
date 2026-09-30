import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { GrupoModificador, OpcionModificador, TipoSeleccion } from "@/types/database";

export type GrupoConOpciones = GrupoModificador & {
  opciones: OpcionModificador[];
  /** Categorías a las que se etiquetó este grupo. Vacío = visible para todas. */
  categoriaIds: string[];
};

export type BorradorGrupo = {
  nombre: string;
  tipo_seleccion: TipoSeleccion;
  obligatorio: boolean;
  min_selecciones: number;
  max_selecciones: number | null;
};

/**
 * Catalogo de grupos de modificadores del tenant, reutilizable entre productos.
 *
 * El limite lo impone el trigger `trg_limite_grupos_mod` leyendo
 * `planes.limite_grupos_modificadores`. Aqui no se valida nada.
 */
export function useGrupos(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["grupos-modificadores", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<GrupoConOpciones[]> => {
      const { data, error } = await supabase
        .from("grupos_modificadores")
        .select(
          "*, opciones:opciones_modificador(*), categorias:categoria_modificadores(categoria_id)",
        )
        .eq("tenant_id", tenantId!)
        .order("orden");
      if (error) throw error;
      return data.map((g) => ({
        ...g,
        opciones: [...g.opciones].sort((a, b) => a.orden - b.orden),
        categoriaIds: g.categorias.map((c) => c.categoria_id),
      }));
    },
  });
}

function useInvalidarGrupos(tenantId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["grupos-modificadores", tenantId] });
    void qc.invalidateQueries({ queryKey: ["uso-tenant", tenantId] });
  };
}

/**
 * Reescribe las categorías etiquetadas de un grupo: borra las que sobran e
 * inserta las nuevas. Mismo patrón que `sincronizarModificadores`.
 */
async function sincronizarCategoriasDeGrupo(grupoId: string, categoriaIds: string[]) {
  const { data: actuales, error: errorLectura } = await supabase
    .from("categoria_modificadores")
    .select("categoria_id")
    .eq("grupo_id", grupoId);
  if (errorLectura) throw errorLectura;

  const antes = new Set(actuales.map((f) => f.categoria_id));
  const despues = new Set(categoriaIds);

  const aBorrar = [...antes].filter((c) => !despues.has(c));
  const aInsertar = [...despues].filter((c) => !antes.has(c));

  if (aBorrar.length) {
    const { error } = await supabase
      .from("categoria_modificadores")
      .delete()
      .eq("grupo_id", grupoId)
      .in("categoria_id", aBorrar);
    if (error) throw error;
  }

  if (aInsertar.length) {
    const { error } = await supabase
      .from("categoria_modificadores")
      .insert(aInsertar.map((categoria_id) => ({ categoria_id, grupo_id: grupoId })));
    if (error) throw error;
  }
}

export function useGuardarGrupo(tenantId: string | undefined) {
  const invalidar = useInvalidarGrupos(tenantId);
  return useMutation({
    mutationFn: async ({
      id,
      datos,
      categoriaIds,
    }: {
      id?: string;
      datos: BorradorGrupo;
      /** `undefined` = no tocar las categorías etiquetadas. */
      categoriaIds?: string[];
    }) => {
      let grupoId = id;
      if (grupoId) {
        const { error } = await supabase
          .from("grupos_modificadores")
          .update(datos)
          .eq("id", grupoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("grupos_modificadores")
          .insert({ ...datos, tenant_id: tenantId! })
          .select("id")
          .single();
        if (error) throw error;
        grupoId = data.id;
      }

      if (categoriaIds !== undefined) await sincronizarCategoriasDeGrupo(grupoId, categoriaIds);
      return grupoId;
    },
    onSuccess: invalidar,
  });
}

export function useGuardarOpcion(tenantId: string | undefined) {
  const invalidar = useInvalidarGrupos(tenantId);
  return useMutation({
    mutationFn: async ({
      id,
      nombre,
      precio_extra,
    }: {
      id: string;
      nombre: string;
      precio_extra: number;
    }) => {
      const { error } = await supabase
        .from("opciones_modificador")
        .update({ nombre, precio_extra })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useBorrarGrupo(tenantId: string | undefined) {
  const invalidar = useInvalidarGrupos(tenantId);
  return useMutation({
    // on delete cascade limpia opciones_modificador y producto_modificadores.
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("grupos_modificadores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useCrearOpcion(tenantId: string | undefined) {
  const invalidar = useInvalidarGrupos(tenantId);
  return useMutation({
    mutationFn: async (opcion: {
      grupo_id: string;
      nombre: string;
      precio_extra: number;
      orden: number;
    }) => {
      const { error } = await supabase.from("opciones_modificador").insert(opcion);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useBorrarOpcion(tenantId: string | undefined) {
  const invalidar = useInvalidarGrupos(tenantId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opciones_modificador").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

/** Grupos ya asignados a un producto. */
export function useGruposDeProducto(productoId: string | undefined) {
  return useQuery({
    queryKey: ["grupos-de-producto", productoId],
    enabled: Boolean(productoId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("producto_modificadores")
        .select("grupo_id")
        .eq("producto_id", productoId!);
      if (error) throw error;
      return data.map((f) => f.grupo_id);
    },
  });
}

/**
 * Reescribe los vinculos de un producto: borra los que sobran e inserta los nuevos.
 * No se borra todo y se reinserta, para no tocar filas que no cambiaron.
 */
export async function sincronizarModificadores(productoId: string, grupoIds: string[]) {
  const { data: actuales, error: errorLectura } = await supabase
    .from("producto_modificadores")
    .select("grupo_id")
    .eq("producto_id", productoId);
  if (errorLectura) throw errorLectura;

  const antes = new Set(actuales.map((f) => f.grupo_id));
  const despues = new Set(grupoIds);

  const aBorrar = [...antes].filter((g) => !despues.has(g));
  const aInsertar = [...despues].filter((g) => !antes.has(g));

  if (aBorrar.length) {
    const { error } = await supabase
      .from("producto_modificadores")
      .delete()
      .eq("producto_id", productoId)
      .in("grupo_id", aBorrar);
    if (error) throw error;
  }

  if (aInsertar.length) {
    const { error } = await supabase
      .from("producto_modificadores")
      .insert(aInsertar.map((grupo_id) => ({ producto_id: productoId, grupo_id })));
    if (error) throw error;
  }
}
