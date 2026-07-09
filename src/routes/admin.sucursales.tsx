import { createFileRoute } from "@tanstack/react-router";
import Sucursales from "@/pages/admin/Sucursales";

export const Route = createFileRoute("/admin/sucursales")({
  component: Sucursales,
});
