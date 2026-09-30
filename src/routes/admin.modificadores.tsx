import { createFileRoute } from "@tanstack/react-router";
import Modificadores from "@/pages/admin/Modificadores";

export const Route = createFileRoute("/admin/modificadores")({
  component: Modificadores,
  validateSearch: (buscar: Record<string, unknown>): { tour?: boolean } => ({
    tour: buscar.tour ? true : undefined,
  }),
});
