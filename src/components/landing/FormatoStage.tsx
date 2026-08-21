import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronsLeftRight, Laptop, Smartphone } from "lucide-react";
import { MockupContenido } from "./MockupFormato";
import type { FormatoMenu } from "@/types/database";
import { cn } from "@/lib/utils";

/**
 * Comparador móvil / escritorio de cada formato.
 *
 * En mouse (hover fino): la posición del cursor sobre el card corre una
 * cortina vertical — a la izquierda se ve el mockup de escritorio (marco de
 * navegador), a la derecha el de celular (marco de teléfono). Al soltar el
 * mouse vuelve a mobile, que es como casi siempre se va a ver la carta.
 *
 * En touch (o cualquier dispositivo sin hover fino): el arrastre de mouse no
 * aplica, así que el mismo botón de abajo alterna entre las dos vistas con
 * una transición suave — la manera confiable de lograrlo entre navegadores,
 * sin los problemas de recorte que trae un giro 3D real sobre una tarjeta
 * con esquinas redondeadas.
 */

const DOMINIO = "cafearoma.vibemenu.com.mx";

export default function FormatoStage({ formato }: { formato: FormatoMenu }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0); // 0 = 100% mobile, 100 = 100% escritorio
  const [canHover, setCanHover] = useState(false);
  const [activo, setActivo] = useState(false);
  const [suave, setSuave] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setCanHover(mq.matches);
    const onChange = () => setCanHover(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const escritorio = pos > 50;

  function moverA(clientX: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }

  function alMover(e: ReactPointerEvent<HTMLDivElement>) {
    if (!canHover) return;
    setSuave(false);
    moverA(e.clientX);
  }

  function alEntrar() {
    if (!canHover) return;
    setActivo(true);
  }

  function alSalir() {
    if (!canHover) return;
    setSuave(true);
    setActivo(false);
    setPos(0);
  }

  function alternar() {
    setSuave(true);
    setPos(escritorio ? 0 : 100);
  }

  return (
    <div className="select-none">
      <div
        ref={stageRef}
        onPointerMove={alMover}
        onPointerEnter={alEntrar}
        onPointerLeave={alSalir}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-vm-bg-soft shadow-vm-1"
      >
        {/* Capa de fondo: escritorio, siempre a lo ancho completo. */}
        <div className="absolute inset-0" aria-hidden>
          <MarcoNavegador formato={formato} />
        </div>

        {/* Capa superior: celular, recortada por una cortina vertical. */}
        <div
          className={cn(
            "absolute inset-0",
            suave && "transition-[clip-path] duration-500 ease-out",
          )}
          style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
          aria-hidden
        >
          <MarcoTelefono formato={formato} />
        </div>

        {/* Línea divisoria, solo visible mientras se puede arrastrar con mouse. */}
        {canHover && (
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 z-10 flex items-center justify-center transition-opacity duration-200",
              activo ? "opacity-100" : "opacity-0",
            )}
            style={{ left: `${pos}%` }}
            aria-hidden
          >
            <div className="h-full w-px bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
            <div className="absolute grid size-7 -translate-x-1/2 place-items-center rounded-full bg-white text-vm-ink shadow-vm-2">
              <ChevronsLeftRight className="size-3.5" aria-hidden />
            </div>
          </div>
        )}

        {/* Control accesible: funciona con teclado, mouse y touch por igual. */}
        <button
          type="button"
          onClick={alternar}
          aria-pressed={escritorio}
          className="absolute bottom-2.5 right-2.5 z-20 inline-flex items-center gap-1.5 rounded-full border bg-white/95 px-2.5 py-1.5 text-[11px] font-medium text-vm-ink shadow-vm-1 backdrop-blur transition-colors hover:bg-white"
        >
          {escritorio ? (
            <>
              <Smartphone className="size-3" aria-hidden />
              Ver en móvil
            </>
          ) : (
            <>
              <Laptop className="size-3" aria-hidden />
              Ver en escritorio
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function MarcoNavegador({ formato }: { formato: FormatoMenu }) {
  return (
    <div className="flex size-full flex-col bg-white">
      <div className="flex shrink-0 items-center gap-1.5 border-b bg-vm-bg-soft px-3 py-2">
        <span className="size-2 rounded-full bg-vm-ink/15" />
        <span className="size-2 rounded-full bg-vm-ink/15" />
        <span className="size-2 rounded-full bg-vm-ink/15" />
        <span className="ml-2 flex-1 truncate rounded-full border bg-white px-3 py-1 text-[9px] text-vm-body">
          {DOMINIO}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <MockupContenido formato={formato} variant="desktop" />
      </div>
    </div>
  );
}

function MarcoTelefono({ formato }: { formato: FormatoMenu }) {
  return (
    <div className="flex size-full items-center justify-center bg-vm-bg-soft p-3">
      <div
        className="relative h-full overflow-hidden rounded-[1.3rem] border-[3px] border-vm-ink bg-white shadow-vm-2"
        style={{ aspectRatio: "9/17.5" }}
      >
        <div className="absolute left-1/2 top-0 z-10 h-3 w-14 -translate-x-1/2 rounded-b-lg bg-vm-ink" />
        <div className="size-full overflow-hidden">
          <MockupContenido formato={formato} variant="phone" />
        </div>
      </div>
    </div>
  );
}
