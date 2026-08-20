import { createFileRoute } from "@tanstack/react-router";
import RestablecerContrasena from "@/pages/RestablecerContrasena";

export const Route = createFileRoute("/restablecer")({
  component: RestablecerContrasena,
});
