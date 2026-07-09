import { createFileRoute } from "@tanstack/react-router";
import QR from "@/pages/admin/QR";

export const Route = createFileRoute("/admin/qr")({
  component: QR,
});
