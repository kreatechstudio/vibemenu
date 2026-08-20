import type { FormatoMenu } from "@/types/database";

/**
 * Mini-mockups reales de cada formato, para la seccion "Formatos" de la landing
 * y para las tarjetas de /admin/diseno.
 *
 * Regla anti-generico: aqui NO va un icono de "grid" o "lista". Cada mockup
 * reproduce la anatomia del formato, con fotos y precios de verdad — hasta la
 * tira de categorias, que es lo que distingue a Pinterest de Instagram.
 *
 * No usa el azul de Vibemenu: los menus publicos llevan el tema del tenant.
 * Aqui se usa el tema de Cafe Aurora (terracota sobre crema).
 */

const CREMA = "#FBF7F2";
const TERRACOTA = "#C2410C";
const CARBON = "#1C1917";

/** Las mismas fotos de /demo. `w` bajo: son miniaturas de 300px como mucho. */
const foto = (id: string, w = 240) =>
  `https://images.unsplash.com/${id}?w=${w}&q=60&auto=format&fit=crop`;

const FOTOS = [
  foto("photo-1509042239860-f550ce710b93"), // café
  foto("photo-1504674900247-0877df9cc836"), // plato
  foto("photo-1565299624946-b28f40a0ae38"), // tacos
  foto("photo-1546069901-ba9599a7e63c"), // bowl
  foto("photo-1512621776951-a57141f2eefd"), // comida
  foto("photo-1414235077428-338989a2e8c0"), // parrilla
] as const;

const CATEGORIAS = ["Todo", "Cafetería", "Desayunos"] as const;

function Pastillas({ sobreOscuro = false }: { sobreOscuro?: boolean }) {
  return (
    <div className="flex gap-1 overflow-hidden">
      {CATEGORIAS.map((c, i) => (
        <span
          key={c}
          className="shrink-0 rounded-full px-2 py-[3px] text-[7px] font-medium"
          style={
            i === 0
              ? sobreOscuro
                ? { background: "#FFF", color: CARBON }
                : { background: CARBON, color: CREMA }
              : sobreOscuro
                ? { background: "rgba(255,255,255,0.2)", color: "#FFF" }
                : { background: `${CARBON}12`, color: CARBON }
          }
        >
          {c}
        </span>
      ))}
    </div>
  );
}

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

/** Pastillas arriba + masonry de alturas variables con fotos reales. */
function Pinterest() {
  const alturas = [52, 74, 60, 44, 66, 50];
  return (
    <div className="h-full w-full overflow-hidden bg-white p-2.5">
      <div className="mb-2">
        <Pastillas />
      </div>

      <div className="columns-3 gap-1.5 [column-fill:_balance]">
        {alturas.map((h, i) => (
          <div key={i} className="mb-1.5 w-full break-inside-avoid">
            <img
              src={FOTOS[i]}
              alt=""
              loading="lazy"
              className="w-full rounded-md object-cover"
              style={{ height: h }}
            />
            <p className="vm-data mt-0.5 text-[7px]" style={{ color: TERRACOTA }}>
              ${[65, 120, 28, 85, 35, 385][i]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Historias arriba + cuadrícula 3×3. */
function Instagram() {
  return (
    <div className="h-full w-full bg-white p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <div className="size-6 rounded-full" style={{ background: `${TERRACOTA}33` }} />
        <div className="space-y-[3px]">
          <div className="h-1.5 w-14 rounded-full" style={{ background: `${CARBON}55` }} />
          <div className="h-1 w-9 rounded-full" style={{ background: `${CARBON}22` }} />
        </div>
      </div>

      {/* Las categorías son los círculos de historias. */}
      <div className="mb-2 flex gap-2">
        {CATEGORIAS.map((c, i) => (
          <div key={c} className="flex w-9 flex-col items-center gap-[2px]">
            <span
              className="grid size-8 place-items-center rounded-full p-[1.5px]"
              style={{ background: i === 0 ? TERRACOTA : `${CARBON}25` }}
            >
              <span className="grid size-full place-items-center rounded-full bg-white p-[1px]">
                <img
                  src={FOTOS[i]}
                  alt=""
                  loading="lazy"
                  className="size-full rounded-full object-cover"
                />
              </span>
            </span>
            <span className="w-full truncate text-center text-[6px]" style={{ color: CARBON }}>
              {c}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-[2px]">
        {Array.from({ length: 9 }).map((_, i) => (
          <img
            key={i}
            src={FOTOS[i % FOTOS.length]}
            alt=""
            loading="lazy"
            className="aspect-square w-full object-cover"
          />
        ))}
      </div>
    </div>
  );
}

/** Fullscreen vertical con foto real, pastillas arriba y overlay abajo. */
function TikTok() {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: CARBON }}>
      <img src={FOTOS[5]} alt="" loading="lazy" className="size-full object-cover" />

      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="absolute inset-x-0 top-0 p-2">
        <Pastillas sobreOscuro />
      </div>

      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-[3px] p-3">
        <p className="text-[10px] font-bold text-white">Parrillada El Primo</p>
        <p className="vm-data text-[9px] text-white">$385.00</p>
        <p className="text-[7px] text-white/70">Arrachera, pollo, chorizo y nopales.</p>
        <span className="mt-1 inline-block rounded-full bg-white/20 px-2 py-[3px] text-[7px] text-white">
          Ver opciones
        </span>
      </div>

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="size-4 rounded-full bg-white/25" />
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
