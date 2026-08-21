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
 *
 * `variant` controla la densidad del contenido:
 * - "mobile": el mockup de siempre, pensado para el recuadro 4:3 chico de
 *   /admin/diseno y /registro. No cambia.
 * - "phone": mas productos, para el marco de telefono (alto, tipo 9:17) del
 *   comparador de FormatoStage — con "mobile" ahi se veria vacio hacia abajo.
 * - "desktop": mas ancho y con mas productos, para el marco de navegador del
 *   mismo comparador.
 */

export type VariantMockup = "mobile" | "phone" | "desktop";

const CREMA = "#FBF7F2";
const TERRACOTA = "#C2410C";
const CARBON = "#1C1917";
// Mismo gris que --menu-modificadores por defecto (ver src/lib/tema.ts) — los
// modificadores nunca van en el color del producto, para que se lean como
// una opción, no como parte del nombre.
const MODIFICADOR = "#57534E";

/** Las mismas fotos de /demo (ya verificadas ahi), en miniatura. */
const foto = (id: string, w = 300) =>
  `https://images.unsplash.com/${id}?w=${w}&q=60&auto=format&fit=crop`;

const FOTOS = [
  foto("photo-1509042239860-f550ce710b93"), // café de olla
  foto("photo-1504674900247-0877df9cc836"), // guacamole
  foto("photo-1565299624946-b28f40a0ae38"), // taco al pastor
  foto("photo-1546069901-ba9599a7e63c"), // agua de horchata
  foto("photo-1512621776951-a57141f2eefd"), // taco campechano
  foto("photo-1414235077428-338989a2e8c0"), // parrillada
  foto("photo-1551782450-a2132b4ba21d"), // taco de suadero
  foto("photo-1541167760496-1628856ab772"), // michelada
] as const;

/**
 * Subconjunto de FOTOS para los círculos de historias de Instagram: ahi la
 * imagen se recorta muy chico y muy cerrado (object-cover en un círculo de
 * ~35px), así que solo entran las fotos con una composición centrada y
 * simple. El café con la planta detrás (FOTOS[0]), el guacamole en
 * molcajete (FOTOS[1]) y la parrillada (FOTOS[5]) tienen demasiadas capas
 * — se ven amontonados/irreconocibles a ese tamaño en vez de redondos.
 */
const FOTOS_HISTORIAS = [FOTOS[7], FOTOS[2], FOTOS[3], FOTOS[4], FOTOS[6]] as const;

const CATEGORIAS = ["Todo", "Cafetería", "Desayunos"] as const;
const CATEGORIAS_AMPLIO = ["Todo", "Cafetería", "Desayunos", "Postres", "Bebidas"] as const;

function Pastillas({
  categorias,
  sobreOscuro = false,
}: {
  categorias: readonly string[];
  sobreOscuro?: boolean;
}) {
  return (
    <div className="flex gap-1 overflow-hidden">
      {categorias.map((c, i) => (
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

type ItemClasico = { nombre: string; precio: string; modificador?: string };

/** El nombre nunca lleva el modificador — va debajo, en gris, como en el formato real. */
function ListaClasico({ items }: { items: ItemClasico[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.nombre}>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[11px] font-medium"
              style={{ color: CARBON, fontFamily: "Georgia, serif" }}
            >
              {item.nombre}
            </span>
            <span
              className="min-w-0 flex-1 border-b border-dotted"
              style={{ borderColor: "#00000033" }}
            />
            <span className="vm-data text-[11px]" style={{ color: CARBON }}>
              ${item.precio}
            </span>
          </div>
          {item.modificador && (
            <p className="mt-0.5 text-[8px] leading-tight" style={{ color: MODIFICADOR }}>
              {item.modificador}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Clasico({ variant }: { variant: VariantMockup }) {
  const cafeteria: ItemClasico[] = [
    { nombre: "Flat White", precio: "65", modificador: "Leche: Entera · Avena (+$8)" },
    { nombre: "Cold Brew", precio: "58" },
    { nombre: "Cappuccino", precio: "55" },
    { nombre: "Latte de Vainilla", precio: "62" },
    { nombre: "Chai Latte", precio: "60" },
  ];
  const desayunos: ItemClasico[] = [
    {
      nombre: "Avocado Toast",
      precio: "120",
      modificador: "Extra: Aguacate (+$15) · Huevo (+$18)",
    },
    { nombre: "Chilaquiles", precio: "135", modificador: "Salsa: Verde · Roja" },
    { nombre: "Huevos Rancheros", precio: "110" },
    { nombre: "Hotcakes de Nuez", precio: "95" },
    { nombre: "Molletes", precio: "89" },
  ];

  if (variant === "mobile") {
    const items: ItemClasico[] = [
      { nombre: "Flat White", precio: "65", modificador: "Leche: Entera · Avena (+$8)" },
      { nombre: "Cold Brew", precio: "58" },
      { nombre: "Avocado Toast", precio: "120" },
      { nombre: "Chilaquiles", precio: "135", modificador: "Salsa: Verde · Roja" },
    ];
    return (
      <div className="h-full w-full p-5" style={{ background: CREMA }}>
        <p
          className="mb-3 text-center text-[9px] font-semibold tracking-[0.2em]"
          style={{ color: TERRACOTA }}
        >
          CAFETERÍA
        </p>
        <ListaClasico items={items} />
      </div>
    );
  }

  if (variant === "phone") {
    return (
      <div className="h-full w-full p-5" style={{ background: CREMA }}>
        <p
          className="mb-3 text-center text-[9px] font-semibold tracking-[0.2em]"
          style={{ color: TERRACOTA }}
        >
          CAFETERÍA
        </p>
        <ListaClasico items={cafeteria} />
        <p
          className="mb-3 mt-5 text-center text-[9px] font-semibold tracking-[0.2em]"
          style={{ color: TERRACOTA }}
        >
          DESAYUNOS
        </p>
        <ListaClasico items={desayunos} />
      </div>
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-2 gap-10 p-8" style={{ background: CREMA }}>
      <div>
        <p className="mb-4 text-[10px] font-semibold tracking-[0.2em]" style={{ color: TERRACOTA }}>
          CAFETERÍA
        </p>
        <ListaClasico items={cafeteria} />
      </div>
      <div>
        <p className="mb-4 text-[10px] font-semibold tracking-[0.2em]" style={{ color: TERRACOTA }}>
          DESAYUNOS
        </p>
        <ListaClasico items={desayunos} />
      </div>
    </div>
  );
}

const ALTURAS_PINTEREST = [52, 74, 60, 44, 66, 50, 58, 70, 48, 62];
const PRECIOS_PINTEREST = [65, 120, 28, 85, 35, 385, 32, 145, 55, 38];

const CONFIG_PINTEREST: Record<
  VariantMockup,
  {
    columnas: number;
    conteo: number;
    padding: number;
    escala: number;
    categorias: readonly string[];
  }
> = {
  mobile: { columnas: 3, conteo: 6, padding: 10, escala: 1, categorias: CATEGORIAS },
  phone: { columnas: 3, conteo: 9, padding: 14, escala: 1.35, categorias: CATEGORIAS },
  desktop: { columnas: 5, conteo: 10, padding: 16, escala: 1.7, categorias: CATEGORIAS_AMPLIO },
};

/** Pastillas arriba + masonry de alturas variables con fotos reales. */
function Pinterest({ variant }: { variant: VariantMockup }) {
  const cfg = CONFIG_PINTEREST[variant];

  return (
    <div className="h-full w-full overflow-hidden bg-white" style={{ padding: cfg.padding }}>
      <div style={{ marginBottom: cfg.padding * 0.7 }}>
        <Pastillas categorias={cfg.categorias} />
      </div>

      <div
        className="[column-fill:_balance]"
        style={{ columnCount: cfg.columnas, columnGap: cfg.padding * 0.65 }}
      >
        {Array.from({ length: cfg.conteo }).map((_, i) => (
          <div
            key={i}
            className="w-full break-inside-avoid"
            style={{ marginBottom: cfg.padding * 0.6 }}
          >
            <img
              src={FOTOS[i % FOTOS.length]}
              alt=""
              loading="lazy"
              className="w-full rounded-md object-cover"
              style={{ height: ALTURAS_PINTEREST[i % ALTURAS_PINTEREST.length] * cfg.escala }}
            />
            <p className="vm-data mt-0.5" style={{ color: TERRACOTA, fontSize: 7 * cfg.escala }}>
              ${PRECIOS_PINTEREST[i % PRECIOS_PINTEREST.length]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const CONFIG_INSTAGRAM: Record<
  VariantMockup,
  {
    columnas: number;
    celdas: number;
    padding: number;
    avatar: number;
    historia: number;
    etiqueta: number;
    categorias: readonly string[];
  }
> = {
  mobile: {
    columnas: 3,
    celdas: 9,
    padding: 10,
    avatar: 24,
    historia: 32,
    etiqueta: 8.5,
    categorias: CATEGORIAS,
  },
  phone: {
    columnas: 3,
    celdas: 12,
    padding: 14,
    avatar: 26,
    historia: 34,
    etiqueta: 9,
    categorias: CATEGORIAS,
  },
  desktop: {
    columnas: 4,
    celdas: 12,
    padding: 16,
    avatar: 28,
    historia: 36,
    etiqueta: 10,
    categorias: CATEGORIAS_AMPLIO,
  },
};

/** Historias arriba + cuadrícula con fotos. */
function Instagram({ variant }: { variant: VariantMockup }) {
  const cfg = CONFIG_INSTAGRAM[variant];

  return (
    <div className="h-full w-full bg-white" style={{ padding: cfg.padding }}>
      <div className="flex items-center gap-2" style={{ marginBottom: cfg.padding * 0.8 }}>
        <div
          className="rounded-full"
          style={{ background: `${TERRACOTA}33`, width: cfg.avatar, height: cfg.avatar }}
        />
        <div className="space-y-[3px]">
          <div
            className="rounded-full"
            style={{ background: `${CARBON}55`, width: cfg.avatar * 2.3, height: 6 }}
          />
          <div
            className="rounded-full"
            style={{ background: `${CARBON}22`, width: cfg.avatar * 1.5, height: 4 }}
          />
        </div>
      </div>

      {/* Las categorías son los círculos de historias. */}
      <div className="flex gap-2" style={{ marginBottom: cfg.padding * 0.8 }}>
        {cfg.categorias.map((c, i) => (
          <div
            key={c}
            className="flex shrink-0 flex-col items-center gap-[3px]"
            style={{ width: cfg.historia + 8 }}
          >
            <span
              className="grid shrink-0 place-items-center rounded-full p-[1.5px]"
              style={{
                background: i === 0 ? TERRACOTA : `${CARBON}25`,
                width: cfg.historia,
                height: cfg.historia,
              }}
            >
              <span className="grid size-full place-items-center rounded-full bg-white p-[1px]">
                <img
                  src={FOTOS_HISTORIAS[i % FOTOS_HISTORIAS.length]}
                  alt=""
                  loading="lazy"
                  className="size-full rounded-full object-cover"
                />
              </span>
            </span>
            <span
              className="w-full truncate text-center font-medium leading-none"
              style={{ color: CARBON, fontSize: cfg.etiqueta }}
            >
              {c}
            </span>
          </div>
        ))}
      </div>

      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${cfg.columnas}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cfg.celdas }).map((_, i) => (
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

function TikTokOverlay({ escala = 1 }: { escala?: number }) {
  return (
    <>
      <div
        className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent"
        style={{ height: 56 * escala }}
      />
      <div className="absolute inset-x-0 top-0" style={{ padding: 8 * escala }}>
        <Pastillas categorias={CATEGORIAS} sobreOscuro />
      </div>

      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-[3px]" style={{ padding: 12 * escala }}>
        <p className="font-bold text-white" style={{ fontSize: 10 * escala }}>
          Parrillada El Primo
        </p>
        <p className="vm-data text-white" style={{ fontSize: 9 * escala }}>
          $385.00
        </p>
        <p className="text-white/70" style={{ fontSize: 7 * escala }}>
          Arrachera, pollo, chorizo y nopales.
        </p>
        <span
          className="mt-1 inline-block rounded-full bg-white/20 text-white"
          style={{ fontSize: 7 * escala, padding: `${3 * escala}px ${8 * escala}px` }}
        >
          Ver opciones
        </span>
      </div>

      <div
        className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col"
        style={{ gap: 8 * escala }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-full bg-white/25"
            style={{ width: 16 * escala, height: 16 * escala }}
          />
        ))}
      </div>
    </>
  );
}

/** Fullscreen vertical con foto real, pastillas arriba y overlay abajo. */
function TikTok({ variant }: { variant: VariantMockup }) {
  if (variant !== "desktop") {
    return (
      <div className="relative h-full w-full overflow-hidden" style={{ background: CARBON }}>
        <img src={FOTOS[5]} alt="" loading="lazy" className="size-full object-cover" />
        <TikTokOverlay />
      </div>
    );
  }

  // Escritorio: como se ve TikTok/Reels en web — video vertical centrado
  // sobre un fondo desenfocado de la misma imagen, para no dejar los
  // costados vacíos dentro de un navegador ancho.
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: CARBON }}>
      <img
        src={FOTOS[5]}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full scale-125 object-cover opacity-40 blur-2xl"
      />
      <div className="absolute inset-0 flex items-center justify-center py-4">
        <div
          className="relative h-full overflow-hidden rounded-xl shadow-2xl"
          style={{ aspectRatio: "9/16" }}
        >
          <img src={FOTOS[5]} alt="" loading="lazy" className="size-full object-cover" />
          <TikTokOverlay escala={1.15} />
        </div>
      </div>
    </div>
  );
}

const MOCKUPS: Record<FormatoMenu, (p: { variant: VariantMockup }) => React.ReactElement> = {
  clasico: Clasico,
  pinterest: Pinterest,
  instagram: Instagram,
  tiktok: TikTok,
};

/** Solo el contenido del mockup, sin marco — para incrustar en un device frame. */
export function MockupContenido({
  formato,
  variant = "mobile",
}: {
  formato: FormatoMenu;
  variant?: VariantMockup;
}) {
  const Mockup = MOCKUPS[formato];
  return <Mockup variant={variant} />;
}

export default function MockupFormato({ formato }: { formato: FormatoMenu }) {
  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border" aria-hidden>
      <MockupContenido formato={formato} variant="mobile" />
    </div>
  );
}
