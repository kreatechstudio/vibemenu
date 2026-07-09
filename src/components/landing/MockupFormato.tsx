import type { FormatoMenu } from "@/types/database";

/**
 * Mini-mockups reales de cada formato, para la seccion "Formatos" de la landing.
 *
 * Regla anti-generico: aqui NO va un icono de "grid" o "lista". Cada mockup
 * reproduce la anatomia del formato — la lista con linea punteada del Clasico,
 * el masonry de Pinterest, la cuadricula de Instagram, el fullscreen de TikTok.
 *
 * No usa el azul de Vibemenu: los menus publicos llevan el tema del tenant.
 * Aqui se usa el tema de Cafe Aurora (terracota sobre crema).
 */

const CREMA = "#FBF7F2";
const TERRACOTA = "#C2410C";
const CARBON = "#1C1917";

function Clasico() {
  const items = [
    ["Flat White", "65"],
    ["Cold Brew", "58"],
    ["Avocado Toast", "120"],
    ["Chilaquiles", "135"],
  ];
  return (
    <div className="h-full w-full p-5" style={{ background: CREMA }}>
      <p
        className="mb-3 text-center text-[9px] font-semibold tracking-[0.2em]"
        style={{ color: TERRACOTA }}
      >
        CAFETERÍA
      </p>
      <ul className="space-y-2.5">
        {items.map(([nombre, precio]) => (
          <li key={nombre} className="flex items-baseline gap-1.5">
            <span
              className="text-[11px] font-medium"
              style={{ color: CARBON, fontFamily: "Georgia, serif" }}
            >
              {nombre}
            </span>
            <span
              className="min-w-0 flex-1 border-b border-dotted"
              style={{ borderColor: "#00000033" }}
            />
            <span className="vm-data text-[11px]" style={{ color: CARBON }}>
              ${precio}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pinterest() {
  const alturas = [46, 68, 58, 40, 62, 50];
  return (
    <div className="h-full w-full overflow-hidden bg-white p-3">
      <div className="columns-3 gap-2 [column-fill:_balance]">
        {alturas.map((h, i) => (
          <div
            key={i}
            className="mb-2 w-full break-inside-avoid rounded-md"
            style={{
              height: h,
              background: i % 2 ? `${TERRACOTA}22` : `${CARBON}14`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Instagram() {
  return (
    <div className="h-full w-full bg-white p-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="size-7 rounded-full" style={{ background: `${TERRACOTA}33` }} />
        <div className="space-y-1">
          <div className="h-1.5 w-16 rounded-full" style={{ background: `${CARBON}55` }} />
          <div className="h-1.5 w-10 rounded-full" style={{ background: `${CARBON}22` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square"
            style={{ background: i % 3 === 1 ? `${TERRACOTA}26` : `${CARBON}12` }}
          />
        ))}
      </div>
    </div>
  );
}

function TikTok() {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: CARBON }}>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 80% at 50% 20%, ${TERRACOTA}66, transparent 70%)`,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-4">
        <div className="h-2 w-24 rounded-full bg-white/90" />
        <div className="h-1.5 w-32 rounded-full bg-white/50" />
        <p className="vm-data pt-1 text-[11px] text-white">$135</p>
      </div>
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="size-5 rounded-full bg-white/25" />
        ))}
      </div>
    </div>
  );
}

const MOCKUPS: Record<FormatoMenu, () => React.ReactElement> = {
  clasico: Clasico,
  pinterest: Pinterest,
  instagram: Instagram,
  tiktok: TikTok,
};

export default function MockupFormato({ formato }: { formato: FormatoMenu }) {
  const Mockup = MOCKUPS[formato];
  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border" aria-hidden>
      <Mockup />
    </div>
  );
}
