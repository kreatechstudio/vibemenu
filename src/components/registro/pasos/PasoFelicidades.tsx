import { useNavigate } from "@tanstack/react-router";
import { PartyPopper } from "lucide-react";

type PasoFelicidadesProps = {
  nombreNegocio: string;
};

export default function PasoFelicidades({ nombreNegocio }: PasoFelicidadesProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-vm-success-soft">
        <PartyPopper className="size-8 text-vm-success" aria-hidden />
      </div>

      <div>
        <h1 className="text-2xl text-vm-ink">¡Felicidades! {nombreNegocio} ya está en Vibemenu</h1>
        <p className="mt-3 text-sm leading-relaxed text-vm-body">
          Tu menú digital está listo para compartirse. Tienes 14 días de prueba con el plan Pro
          para explorar personalización, modificadores, códigos QR y más.
        </p>
      </div>

      <span className="rounded-full bg-vm-warning-soft px-3 py-1 text-xs font-medium text-vm-warning">
        Prueba Pro · 14 días
      </span>

      <button
        type="button"
        onClick={() => void navigate({ to: "/admin" })}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover"
      >
        Ir a mi panel
      </button>
    </div>
  );
}
