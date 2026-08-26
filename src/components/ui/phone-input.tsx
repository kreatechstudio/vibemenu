import { useState } from "react";

/** Códigos más usados por los negocios del producto. Lista corta a propósito. */
export const CODIGOS_PAIS = [
  { pais: "México", codigo: "+52" },
  { pais: "Estados Unidos / Canadá", codigo: "+1" },
  { pais: "Guatemala", codigo: "+502" },
  { pais: "Colombia", codigo: "+57" },
  { pais: "Argentina", codigo: "+54" },
  { pais: "Chile", codigo: "+56" },
  { pais: "Perú", codigo: "+51" },
  { pais: "España", codigo: "+34" },
  { pais: "Brasil", codigo: "+55" },
  { pais: "Ecuador", codigo: "+593" },
] as const;

/**
 * Separa "+52 55 1234 5678" en código y resto. Si no reconoce el código (o el
 * valor no trae "+"), no toca nada: asume México y deja el resto tal cual —
 * así un número viejo sin prefijo no pierde ni un carácter al abrir el editor.
 */
function partirNumero(valor: string): { codigo: string; resto: string } {
  const encontrado = [...CODIGOS_PAIS]
    .sort((a, b) => b.codigo.length - a.codigo.length)
    .find((c) => valor.startsWith(c.codigo));

  if (!encontrado) return { codigo: "+52", resto: valor };
  return { codigo: encontrado.codigo, resto: valor.slice(encontrado.codigo.length).trim() };
}

/**
 * Teléfono con selector de código de país. Se guarda como un solo texto
 * ("+52 55 1234 5678"): el selector solo antepone el código, el número se
 * guarda tal como el usuario lo escribe, sin reformatear.
 */
export default function PhoneInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  // Como en el resto de estos formularios, se siembra una vez desde el valor
  // guardado; el propio componente es dueño del estado después de eso.
  const [codigo, setCodigo] = useState(() => partirNumero(value).codigo);
  const [resto, setResto] = useState(() => partirNumero(value).resto);

  function cambiarCodigo(nuevo: string) {
    setCodigo(nuevo);
    onChange(resto.trim() ? `${nuevo} ${resto}`.trim() : "");
  }

  function cambiarResto(nuevo: string) {
    setResto(nuevo);
    onChange(nuevo.trim() ? `${codigo} ${nuevo}`.trim() : "");
  }

  return (
    <div className="mt-2 flex h-12 overflow-hidden rounded-lg border focus-within:border-vm-primary focus-within:ring-2 focus-within:ring-vm-primary/20">
      <label className="sr-only" htmlFor={`${id}-codigo`}>
        Código de país
      </label>
      <select
        id={`${id}-codigo`}
        value={codigo}
        onChange={(e) => cambiarCodigo(e.target.value)}
        className="vm-data h-full shrink-0 border-r bg-vm-bg-soft px-2 text-sm outline-none"
      >
        {CODIGOS_PAIS.map((c) => (
          <option key={c.codigo} value={c.codigo}>
            {c.codigo} {c.pais}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        value={resto}
        onChange={(e) => cambiarResto(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 px-4 text-sm outline-none"
      />
    </div>
  );
}
