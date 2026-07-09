import { createFileRoute } from "@tanstack/react-router";
import Precios from "@/pages/Precios";

export const Route = createFileRoute("/precios")({
  component: Precios,
});
