import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Paso de un tour guiado, en español. `elemento` es el selector CSS del
 * control real que se señala (un atributo `data-tour="..."` en el JSX de la
 * página) — sin él, el paso se muestra centrado, sin spotlight.
 */
export type PasoTour = {
  elemento?: string;
  titulo: string;
  descripcion: string;
};

/**
 * Arma un tour de driver.js a partir de pasos en español. `skipMissingElement`
 * hace que cualquier paso cuyo elemento no exista hoy en el DOM (una
 * categoría que el negocio aún no crea, una sucursal que no tiene) se salte
 * solo, en vez de romper el tour — así cada página declara su tour "ideal"
 * sin armar condicionales propias para cada estado vacío.
 */
export function crearTour(pasos: PasoTour[]) {
  const steps: DriveStep[] = pasos.map((p) => ({
    element: p.elemento,
    popover: { title: p.titulo, description: p.descripcion },
  }));

  return driver({
    steps,
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Atrás",
    doneBtnText: "Listo",
    skipMissingElement: true,
    popoverClass: "vm-tour-popover",
  });
}
