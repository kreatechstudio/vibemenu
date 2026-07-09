import { createFileRoute } from "@tanstack/react-router";
import Registro from "@/pages/Registro";

export const Route = createFileRoute("/registro")({
  component: Registro,
});
