import { createFileRoute } from "@tanstack/react-router";
import Terminos from "@/pages/Terminos";

export const Route = createFileRoute("/terminos")({
  component: Terminos,
});
