import { createFileRoute } from "@tanstack/react-router";
import Opiniones from "@/pages/admin/Opiniones";

export const Route = createFileRoute("/admin/opiniones")({
  component: Opiniones,
});
