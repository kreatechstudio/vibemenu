import { createContext } from "react";

/**
 * Nodo DOM dentro del contenedor que trae las variables `--menu-*` del tema
 * (ver `variablesDeTema`). Los modales del menú público se portean ahí en vez
 * de a `document.body`: así escapan a los ancestros con `transform` de
 * framer-motion en el grid (que rompen el `position: fixed` del backdrop)
 * SIN perder la herencia de las variables de tema, que `document.body` no
 * tiene por estar fuera del `<main style={variablesDeTema(...)}>`.
 */
export const ContenedorTemaContext = createContext<HTMLElement | null>(null);
