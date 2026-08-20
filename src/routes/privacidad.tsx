import { createFileRoute } from "@tanstack/react-router";
import Privacidad from "@/pages/Privacidad";

export const Route = createFileRoute("/privacidad")({
  component: Privacidad,
});
