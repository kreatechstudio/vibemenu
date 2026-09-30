import { createFileRoute } from "@tanstack/react-router";
import Lealtad from "@/pages/admin/Lealtad";

export const Route = createFileRoute("/admin/lealtad")({
  component: Lealtad,
  // `codigo`: llega del botón flotante de escaneo (BotonEscanerLealtad), que
  // vive fuera de esta página y necesita una forma de "entregar" el código leído.
  validateSearch: (buscar: Record<string, unknown>): { codigo?: string } => ({
    codigo: typeof buscar.codigo === "string" ? buscar.codigo : undefined,
  }),
});
