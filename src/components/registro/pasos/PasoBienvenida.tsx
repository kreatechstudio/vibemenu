import { UtensilsCrossed } from "lucide-react";
import { REGISTRO } from "@/lib/copy";

type PasoBienvenidaProps = {
  onContinuar: () => void;
};

export default function PasoBienvenida({ onContinuar }: PasoBienvenidaProps) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-vm-primary/10">
        <UtensilsCrossed className="size-8 text-vm-primary" aria-hidden />
      </div>

      <div>
        <h1 className="text-2xl text-vm-ink">Bienvenido a Vibemenu</h1>
        <p className="mt-3 text-sm leading-relaxed text-vm-body">
          Tu cuenta ya está lista. Ahora vamos a armar tu negocio paso a paso — en unos minutos
          tu menú digital estará listo para tus clientes.
        </p>
      </div>

      <button
        type="button"
        onClick={onContinuar}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover"
      >
        Vamos a crear tu negocio
      </button>

      <p className="text-xs text-vm-body">{REGISTRO.nota}</p>
    </div>
  );
}
