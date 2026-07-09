import type { ReactElement } from "react";
import HeaderMenu from "@/components/menu/HeaderMenu";
import MarcaAgua from "@/components/menu/MarcaAgua";
import MenuNoEncontrado from "@/components/menu/MenuNoEncontrado";
import Clasico from "@/components/formatos/Clasico";
import Pinterest from "@/components/formatos/Pinterest";
import Instagram from "@/components/formatos/Instagram";
import TikTok from "@/components/formatos/TikTok";
import { useMenuPublico, type CategoriaConProductos } from "@/hooks/useMenuPublico";
import { resolverTema, variablesDeTema } from "@/lib/tema";
import { ESTADOS } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { FormatoMenu } from "@/types/database";

interface MenuPublicoProps {
  slug: string;
  sucursalSlug?: string;
}

const FORMATOS: Record<FormatoMenu, (p: { categorias: CategoriaConProductos[] }) => ReactElement> =
  {
    clasico: Clasico,
    pinterest: Pinterest,
    instagram: Instagram,
    tiktok: TikTok,
  };

/**
 * Menu publico del tenant, en `/:slug` y `/:slug/sucursal/:sucursalSlug`.
 *
 * NO usa <Layout>: ese es el cascaron de marketing con la navbar y el footer de
 * Vibemenu. Aqui manda el tema del negocio; lo unico de la plataforma que puede
 * aparecer es la marca de agua, y solo si su plan la trae.
 *
 * TikTok es fullscreen y se lleva la pantalla entera, sin cabecera propia.
 */
export default function MenuPublico({ slug, sucursalSlug }: MenuPublicoProps) {
  const { data, isLoading, isError } = useMenuPublico(slug, sucursalSlug);

  if (isLoading) {
    return (
      <main
        className="min-h-screen animate-pulse bg-vm-bg-soft"
        aria-busy="true"
        aria-label="Cargando menú"
      />
    );
  }

  // El loader de la ruta ya garantizó que el menú existe (y respondió 404 si no).
  // Aquí solo queda el caso de que la consulta falle en el cliente.
  if (isError || !data) return <MenuNoEncontrado />;

  const tema = resolverTema(data.tenant.tema, data.formato);
  const Formato = FORMATOS[data.formato];

  if (data.formato === "tiktok") {
    return (
      <main className="relative h-dvh overflow-hidden" style={variablesDeTema(tema)}>
        <Formato categorias={data.categorias} />
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
      />

      {data.categorias.length === 0 ? (
        <p className="px-4 py-20 text-center text-sm" style={{ color: "var(--menu-texto-suave)" }}>
          Este menú todavía no tiene productos.
        </p>
      ) : (
        <Formato categorias={data.categorias} />
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
    return (
      <main
        className="min-h-screen bg-cover bg-center bg-fixed p-3 sm:p-8"
        style={{ ...estiloRaiz, backgroundImage: `url(${tema.imagen_fondo_url})` }}
      >
        <div
          className="mx-auto max-w-3xl overflow-hidden rounded-2xl shadow-vm-3"
          style={{ background: "var(--menu-fondo)" }}
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
