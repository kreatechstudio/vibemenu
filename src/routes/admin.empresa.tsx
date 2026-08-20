import { createFileRoute } from "@tanstack/react-router";
import Empresa from "@/pages/admin/Empresa";

export const Route = createFileRoute("/admin/empresa")({
  component: Empresa,
});
