import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import EscanerCodigo from "@/components/admin/EscanerCodigo";
import { normalizarCodigo } from "@/lib/lealtad";

/**
 * Acceso rápido a "sellar/canjear" desde cualquier pantalla del panel, no solo
 * desde /admin/lealtad — así el mesero no tiene que navegar para atender a un
 * cliente parado frente a él. Solo se monta si el negocio tiene lealtad activa
 * (ver AdminLayout). Al escanear, manda el código a Lealtad vía search param.
 */
export default function BotonEscanerLealtad() {
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Escanear tarjeta de lealtad"
        className="fixed right-4 bottom-20 z-30 flex size-14 items-center justify-center rounded-full bg-vm-primary text-white shadow-vm-3 transition-transform hover:scale-105 hover:bg-vm-primary-hover lg:right-6 lg:bottom-6"
      >
        <QrCode className="size-6" aria-hidden />
      </button>

      {abierto && (
        <EscanerCodigo
          onCodigo={(texto) => {
            setAbierto(false);
            void navigate({ to: "/admin/lealtad", search: { codigo: normalizarCodigo(texto) } });
          }}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
