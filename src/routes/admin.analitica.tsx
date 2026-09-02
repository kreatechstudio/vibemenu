import { createFileRoute } from "@tanstack/react-router";
import Analitica from "@/pages/admin/Analitica";

export const Route = createFileRoute("/admin/analitica")({
  component: Analitica,
});
