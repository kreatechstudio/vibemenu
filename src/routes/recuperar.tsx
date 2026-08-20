import { createFileRoute } from "@tanstack/react-router";
import RecuperarContrasena from "@/pages/RecuperarContrasena";

export const Route = createFileRoute("/recuperar")({
  component: RecuperarContrasena,
});
