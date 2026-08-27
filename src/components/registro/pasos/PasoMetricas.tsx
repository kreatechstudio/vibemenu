import { useState } from "react";
import { guardarRespuestasOnboarding } from "@/lib/registro";
import { cn } from "@/lib/utils";

const PREGUNTA_1 = "¿Cómo manejas tu menú hoy?";
const OPCIONES_1 = [
  "Papel o impreso",
  "PDF o Word",
  "Redes sociales",
  "Otra app de menú digital",
  "Aún no tengo uno",
];

const PREGUNTA_2 = "¿Cuál es tu mayor dolor de cabeza con tu menú actual?";
const OPCIONES_2 = [
  "Actualizar precios es lento",
  "No se ve profesional",
  "Batallo para tomar pedidos",
  "Los clientes no ven fotos u opciones claras",
  "Otro",
];

const PREGUNTA_3 = "¿Cómo nos conociste?";
const OPCIONES_3 = ["Redes sociales", "Recomendación", "Búsqueda en Google", "Otro"];

type PasoMetricasProps = {
  tenantId: string;
  onContinuar: () => void;
};

function GrupoOpciones({
  pregunta,
  opciones,
  valor,
  alElegir,
}: {
  pregunta: string;
  opciones: string[];
  valor: string | null;
  alElegir: (opcion: string) => void;
}) {
  return (
    <div>
      <span className="text-sm font-medium text-vm-ink">{pregunta}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {opciones.map((opcion) => (
          <button
            key={opcion}
            type="button"
            onClick={() => alElegir(opcion === valor ? "" : opcion)}
            className={cn(
              "h-9 rounded-lg border px-3 text-xs transition-colors",
              valor === opcion
                ? "border-vm-primary bg-vm-primary text-white"
                : "text-vm-ink hover:border-vm-primary",
            )}
          >
            {opcion}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PasoMetricas({ tenantId, onContinuar }: PasoMetricasProps) {
  const [comoManejasMenu, setComoManejasMenu] = useState<string | null>(null);
  const [dolorPrincipal, setDolorPrincipal] = useState<string | null>(null);
  const [dolorPrincipalOtro, setDolorPrincipalOtro] = useState("");
  const [comoNosConociste, setComoNosConociste] = useState<string | null>(null);
  const [comoNosConocisteOtro, setComoNosConocisteOtro] = useState("");

  function alContinuar() {
    const respuestas: Record<string, string> = {};
    if (comoManejasMenu) respuestas.como_manejas_menu = comoManejasMenu;
    if (dolorPrincipal) {
      respuestas.dolor_principal = dolorPrincipal;
      if (dolorPrincipal === "Otro" && dolorPrincipalOtro.trim()) {
        respuestas.dolor_principal_otro = dolorPrincipalOtro.trim();
      }
    }
    if (comoNosConociste) {
      respuestas.como_nos_conociste = comoNosConociste;
      if (comoNosConociste === "Otro" && comoNosConocisteOtro.trim()) {
        respuestas.como_nos_conociste_otro = comoNosConocisteOtro.trim();
      }
    }
    void guardarRespuestasOnboarding(tenantId, respuestas);
    onContinuar();
  }

  return (
    <div>
      <h1 className="text-2xl text-vm-ink">Cuéntanos un poco más</h1>
      <p className="mt-2 text-sm text-vm-body">
        Nos ayuda a mejorar Vibemenu para negocios como el tuyo.
      </p>

      <div className="mt-6 space-y-6">
        <GrupoOpciones
          pregunta={PREGUNTA_1}
          opciones={OPCIONES_1}
          valor={comoManejasMenu}
          alElegir={setComoManejasMenu}
        />

        <div>
          <GrupoOpciones
            pregunta={PREGUNTA_2}
            opciones={OPCIONES_2}
            valor={dolorPrincipal}
            alElegir={setDolorPrincipal}
          />
          {dolorPrincipal === "Otro" && (
            <input
              value={dolorPrincipalOtro}
              onChange={(e) => setDolorPrincipalOtro(e.target.value)}
              placeholder="Cuéntanos"
              className="mt-2 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          )}
        </div>

        <div>
          <GrupoOpciones
            pregunta={PREGUNTA_3}
            opciones={OPCIONES_3}
            valor={comoNosConociste}
            alElegir={setComoNosConociste}
          />
          {comoNosConociste === "Otro" && (
            <input
              value={comoNosConocisteOtro}
              onChange={(e) => setComoNosConocisteOtro(e.target.value)}
              placeholder="Cuéntanos"
              className="mt-2 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-5">
        <button
          type="button"
          onClick={onContinuar}
          className="text-sm font-medium text-vm-body underline hover:text-vm-primary"
        >
          Omitir
        </button>
        <button
          type="button"
          onClick={alContinuar}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-vm-primary px-6 text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
