import { useEffect, useRef } from "react";
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
 * Arma un tour de driver.js a partir de pasos en español. Antes de armar los
 * `steps`, se descartan los pasos cuyo elemento no existe hoy en el DOM (una
 * categoría que el negocio aún no crea, una sucursal que no tiene) — así el
 * contador de progreso de driver.js ("N de M") cuenta solo lo que el usuario
 * realmente va a ver, en vez de saltar de "3 de 6" a "5 de 6". `skipMissingElement`
 * se deja como red de seguridad por si un elemento presente al armar el tour
 * desaparece del DOM antes de que driver.js llegue a ese paso.
 */
export function crearTour(pasos: PasoTour[]) {
  const presentes = pasos.filter((p) => !p.elemento || document.querySelector(p.elemento));

  const steps: DriveStep[] = presentes.map((p) => ({
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

/**
 * Función `navigate` de `routeApi.useNavigate()`. Las tres páginas que usan
 * `useIniciarTour` traen cada una su propio tipo (distinto por la ruta de
 * origen), pero todas aceptan `{ search, replace }` — se tipa laxo a
 * propósito para aceptar las tres sin fricción de generics de TanStack Router.
 */
type NavegarTour = (opciones: { search: Record<string, never>; replace: boolean }) => unknown;

/**
 * Arranca un tour guiado una sola vez, cuando el flag `?tour=1` está activo
 * Y los datos propios de la página ya están listos (evita que driver.js
 * busque un `data-tour` que el primer render, con las queries todavía en
 * curso, aún no puso en el DOM). El `useRef` asegura que arranca una sola
 * vez — a salvo de StrictMode y de que `activo`/`listo`/`navigate` cambien
 * de referencia entre renders.
 *
 * La creación del tour y el `.drive()` van separados: el tour se crea (y se
 * guarda para poder destruirlo) apenas se cumplen las condiciones, pero
 * `.drive()` espera un frame para asegurarse de que el DOM recién montado ya
 * pintó. Si la página se desmonta a medio tour (por ejemplo, un `<Link>`
 * dentro de un elemento resaltado), el cleanup cancela el frame pendiente y
 * destruye la instancia — así no queda overlay ni bloqueo de scroll vivos
 * fuera de la página.
 */
export function useIniciarTour(
  activo: boolean,
  listo: boolean,
  pasos: PasoTour[],
  navigate: NavegarTour,
) {
  const iniciado = useRef(false);
  const instanciaRef = useRef<ReturnType<typeof crearTour> | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activo || !listo || iniciado.current) return;
    iniciado.current = true;

    frameRef.current = requestAnimationFrame(() => {
      const tour = crearTour(pasos);
      instanciaRef.current = tour;
      tour.drive();
    });
    void navigate({ search: {}, replace: true });
  }, [activo, listo, pasos, navigate]);

  // Efecto aparte, solo de desmontaje: si estuviera en el mismo efecto de
  // arriba, React dispararía este cleanup en cuanto `activo` cambiara a
  // `false` (justo lo que pasa al limpiar el search param), destruyendo el
  // tour recién creado antes de que el usuario lo vea.
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      instanciaRef.current?.destroy();
    };
  }, []);
}
