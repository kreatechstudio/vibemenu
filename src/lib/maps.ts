import type { Sucursal } from "@/types/database";

/**
 * Enlace a Google Maps de una sucursal.
 *
 * Si el dueno pego su enlace (el de "Compartir" en Maps, que apunta al negocio
 * verificado con sus resenas y su horario), se usa ese. Si no, se arma una
 * busqueda con la direccion escrita: peor, pero no deja al comensal sin mapa.
 *
 * Devuelve null si no hay ni enlace ni direccion: entonces no se pinta el link.
 */
export function enlaceMaps(
  sucursal: Pick<Sucursal, "direccion" | "maps_url">,
  nombreNegocio?: string,
): string | null {
  const propio = sucursal.maps_url?.trim();
  if (propio) return propio;

  const direccion = sucursal.direccion?.trim();
  if (!direccion) return null;

  // El nombre ayuda a que Maps caiga en el negocio y no en el numero de la calle.
  const consulta = nombreNegocio ? `${nombreNegocio}, ${direccion}` : direccion;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}
