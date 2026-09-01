import { createFileRoute } from "@tanstack/react-router";
import Reservaciones from "@/pages/admin/Reservaciones";

export const Route = createFileRoute("/admin/reservaciones")({
  component: Reservaciones,
});
