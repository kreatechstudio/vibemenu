import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Magic UI — Number Ticker. Tomado de https://magicui.design/r/number-ticker.json
 *
 * Adaptado: import desde framer-motion en vez de "motion/react", locale es-MX en
 * vez de en-US, y sin color de texto por defecto (lo pone quien lo usa).
 *
 * Uso en Vibemenu: metricas del panel admin (total productos, sucursales, visitas).
 *
 * El original renderiza `{startValue}` como hijo y luego escribe el numero a mano
 * en `ref.current.textContent`. Eso se rompe en cuanto el padre vuelve a pintar
 * por cualquier motivo — un refetch de react-query al volver a la pestana, por
 * ejemplo: React reescribe el hijo, deja "0" en pantalla, y el spring ya no tiene
 * nada que animar porque su valor no cambio. El dashboard mostraba 0 productos
 * teniendo 2. Aqui el hijo es SIEMPRE el valor actual del spring, asi que un
 * repintado escribe exactamente lo que ya se veia.
 */
interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
}

const formatear = (n: number, decimales: number) =>
  Intl.NumberFormat("es-MX", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(Number(n.toFixed(decimales)));

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isInView) {
      timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value);
      }, delay * 1000);
    }

    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [motionValue, isInView, delay, value, direction, startValue]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) ref.current.textContent = formatear(latest, decimalPlaces);
      }),
    [springValue, decimalPlaces],
  );

  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)} {...props}>
      {formatear(springValue.get(), decimalPlaces)}
    </span>
  );
}
