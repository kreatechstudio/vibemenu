import { createFileRoute } from "@tanstack/react-router";
import CompletarAcceso from "@/pages/CompletarAcceso";

export const Route = createFileRoute("/auth/completar")({
  component: CompletarAcceso,
});
