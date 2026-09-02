import { createFileRoute } from "@tanstack/react-router";
import Lealtad from "@/pages/admin/Lealtad";

export const Route = createFileRoute("/admin/lealtad")({
  component: Lealtad,
});
