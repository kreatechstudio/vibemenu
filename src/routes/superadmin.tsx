import { createFileRoute } from "@tanstack/react-router";
import SuperAdmin from "@/pages/SuperAdmin";

export const Route = createFileRoute("/superadmin")({
  component: SuperAdmin,
});
