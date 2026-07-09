import { createFileRoute } from "@tanstack/react-router";
import Modificadores from "@/pages/admin/Modificadores";

export const Route = createFileRoute("/admin/modificadores")({
  component: Modificadores,
});
