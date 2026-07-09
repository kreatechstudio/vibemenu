import { createFileRoute } from "@tanstack/react-router";
import Menu from "@/pages/admin/Menu";

export const Route = createFileRoute("/admin/menu")({
  component: Menu,
});
