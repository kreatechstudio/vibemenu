import { useEffect, useState, type ReactElement } from "react";
import { Loader2 } from "lucide-react";
import HeaderMenu from "@/components/menu/HeaderMenu";
import MarcaAgua from "@/components/menu/MarcaAgua";
import MenuNoEncontrado from "@/components/menu/MenuNoEncontrado";
import Clasico from "@/components/formatos/Clasico";
import Pinterest from "@/components/formatos/Pinterest";
import Instagram from "@/components/formatos/Instagram";
import TikTok from "@/components/formatos/TikTok";
import {
  useMenuPublico,
  type CategoriaConProductos,
  type MenuPublico as DatosMenu,
} from "@/hooks/useMenuPublico";
import { useRegistrarVisita } from "@/hooks/useVisitas";
import { resolverTema, variablesDeTema } from "@/lib/tema";
import { ESTADOS } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { FormatoMenu, Tenant } from "@/types/database";

interface MenuPublicoProps {
  slug: string;
  sucursalSlug?: string;
  /** Viene del loader de la ruta: el menú ya está resuelto en el servidor. */
  inicial?: DatosMenu;
}

/** Instagram usa `logoUrl` e `inicial` para el círculo "Todo". El resto los ignora. */
type PropsFormato = {
  categorias: CategoriaConProductos[];
  logoUrl?: string | null;
  inicial?: string;
};

const FORMATOS: Record<FormatoMenu, (p: PropsFormato) => ReactElement> = {
  clasico: Clasico,
  pinterest: Pinterest,
  instagram: Instagram,
  tiktok: TikTok,
};

/**
 * Se ve mientras carga el menú — con el logo y el color de fondo del negocio,
 * no con el esqueleto gris de la plataforma. Solo se puede pintar así cuando
 * ya se conoce al tenant (por ejemplo, al cambiar de sucursal, donde el
 * anterior sigue siendo el mismo negocio); sin eso no hay de quién tomar el
 * logo o el color, y se cae al esqueleto neutro de siempre.
 */
function SplashCarga({ conocido }: { conocido: { tenant: Tenant; formato: FormatoMenu } | null }) {
  if (!conocido) {
    return (
      <main
        className="min-h-screen animate-pulse bg-vm-bg-soft"
        aria-busy="true"
        aria-label="Cargando menú"
      />
    );
  }

  const { tenant, formato } = conocido;
  const tema = resolverTema(tenant.tema, formato);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-5"
      style={{ background: tema.color_fondo }}
      aria-busy="true"
      aria-label={`Cargando el menú de ${tenant.nombre_negocio}`}
    >
      {tenant.logo_url ? (
        <img
          src={tenant.logo_url}
          alt=""
          className="size-20 animate-pulse rounded-full object-cover shadow-vm-2"
        />
      ) : (
        <div
          className="grid size-20 animate-pulse place-items-center rounded-full text-2xl font-bold text-white shadow-vm-2"
          style={{ background: tema.color_primario }}
          aria-hidden
        >
          {tenant.nombre_negocio.slice(0, 1).toUpperCase()}
        </div>
      )}
      <Loader2 className="size-6 animate-spin" style={{ color: tema.color_primario }} aria-hidden />
    </main>
  );
}

/**
 * Menu publico del tenant, en `/:slug` y `/:slug/sucursal/:sucursalSlug`.
 *
 * NO usa <Layout>: ese es el cascaron de marketing con la navbar y el footer de
 * Vibemenu. Aqui manda el tema del negocio; lo unico de la plataforma que puede
 * aparecer es la marca de agua, y solo si su plan la trae.
 *
 * TikTok es fullscreen y se lleva la pantalla entera, sin cabecera propia.
 */
export default function MenuPublico({ slug, sucursalSlug, inicial }: MenuPublicoProps) {
  const { data, isLoading, isError } = useMenuPublico(slug, sucursalSlug, inicial);

  // Para el splash de carga: si el tenant cambia de sucursal (o vuelve a
  // cargar), esto sigue teniendo su logo y color mientras llega el nuevo dato.
  const [ultimoConocido, setUltimoConocido] = useState(
    inicial ? { tenant: inicial.tenant, formato: inicial.formato } : null,
  );
  useEffect(() => {
    if (data) setUltimoConocido({ tenant: data.tenant, formato: data.formato });
  }, [data]);

  // Desde el navegador, nunca desde el loader: ahí contaríamos los prefetch del
  // router y cada rastreador que pase por la ruta.
  useRegistrarVisita(data?.tenant.id, data?.sucursalActiva?.id ?? null);

  if (isLoading) {
    return <SplashCarga conocido={ultimoConocido} />;
  }

  // El loader de la ruta ya garantizó que el menú existe (y respondió 404 si no).
  // Aquí solo queda el caso de que la consulta falle en el cliente.
  if (isError || !data) return <MenuNoEncontrado />;

  const tema = resolverTema(data.tenant.tema, data.formato);
  const Formato = FORMATOS[data.formato];

  const propsFormato: PropsFormato = {
    categorias: data.categorias,
    logoUrl: data.tenant.logo_url,
    inicial: data.tenant.nombre_negocio.slice(0, 1),
  };

  if (data.formato === "tiktok") {
    return (
      <main className="relative h-dvh overflow-hidden" style={variablesDeTema(tema)}>
        <Formato {...propsFormato} />
        {data.marcaAgua && <MarcaAgua flotante />}
      </main>
    );
  }

  const cuerpo = (
    <>
      <HeaderMenu
        tenant={data.tenant}
        sucursales={data.sucursales}
        sucursalActiva={data.sucursalActiva}
        menuIndependiente={data.menuIndependiente}
        compacta={data.formato === "instagram"}
        sobreOscuro={tema.modo_imagen === "completo"}
      />

      {data.categorias.length === 0 ? (
        <p className="px-4 py-20 text-center text-sm" style={{ color: "var(--menu-texto-suave)" }}>
          Este menú todavía no tiene productos.
        </p>
      ) : (
        <Formato {...propsFormato} />
      )}

      {data.marcaAgua && <MarcaAgua />}
    </>
  );

  const estiloRaiz = variablesDeTema(tema);

  /**
   * Modo `marco`: la foto enmarca y la carta va en una tarjeta al centro.
   * Modo `completo`: la foto ocupa el fondo, con un velo oscuro; si el tenant
   * activó el desenfoque, el contenido lleva backdrop-blur para que se lea.
   * Los dos modos los gobierna `planes.modos_imagen_permitidos`.
   */
  if (tema.modo_imagen === "marco") {
    // Con desenfoque se difumina LA FOTO, no la tarjeta. El marco queda como un
    // fondo de bokeh y la carta, translúcida, lo deja translucir. Sin desenfoque,
    // foto nítida y tarjeta opaca.
    const tarjeta: React.CSSProperties = tema.desenfoque_texto
      ? { background: "color-mix(in srgb, var(--menu-fondo) 78%, transparent)" }
      : { background: "var(--menu-fondo)" };

    return (
      <main className="relative min-h-screen p-3 sm:p-8" style={estiloRaiz}>
        {/*
          Capa aparte, no `bg-fixed` en el <main>: un `filter: blur` en el padre
          también difuminaría la carta. El scale-110 esconde los bordes lavados
          que el desenfoque deja en la orilla de la foto.
        */}
        <div
          aria-hidden
          className={cn(
            "fixed inset-0 -z-10 bg-cover bg-center",
            tema.desenfoque_texto && "scale-110 blur-lg",
          )}
          style={{ backgroundImage: `url(${tema.imagen_fondo_url})` }}
        />

        <div
          className={cn(
            "mx-auto max-w-3xl overflow-hidden rounded-2xl shadow-vm-3",
            tema.desenfoque_texto && "backdrop-blur-sm",
          )}
          style={tarjeta}
        >
          {cuerpo}
        </div>
      </main>
    );
  }

  if (tema.modo_imagen === "completo") {
    // El texto va sobre la foto y el velo oscuro: los colores del tenant se
    // sobreescriben por blancos, o el menu queda ilegible.
    const sobreFoto = {
      ...estiloRaiz,
      "--menu-texto": "#FFFFFF",
      "--menu-texto-suave": "rgba(255,255,255,0.78)",
      "--menu-modificadores": "rgba(255,255,255,0.65)",
      backgroundImage: `url(${tema.imagen_fondo_url})`,
    } as React.CSSProperties;

    return (
      <main className="relative min-h-screen bg-cover bg-center bg-fixed" style={sobreFoto}>
        <div className="absolute inset-0 bg-black/50" aria-hidden />
        <div className={cn("relative min-h-screen", tema.desenfoque_texto && "backdrop-blur-sm")}>
          {cuerpo}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ ...estiloRaiz, background: "var(--menu-fondo)" }}>
      {cuerpo}
    </main>
  );
}
