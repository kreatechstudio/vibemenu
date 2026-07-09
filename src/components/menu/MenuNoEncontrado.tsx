import { ESTADOS } from "@/lib/copy";

/**
 * Se renderiza cuando el loader lanza notFound(). Al venir del loader, la
 * respuesta HTTP es un 404 real y no un 200 con esta pantalla dentro.
 *
 * No lleva navbar ni footer de Vibemenu: sigue siendo la URL de un tenant.
 */
export default function MenuNoEncontrado() {
  return (
    <main className="grid min-h-screen place-items-center bg-white px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl text-vm-ink">{ESTADOS.menuNoEncontrado}</h1>
        <a
          href="/"
          className="mt-6 inline-block text-sm font-medium text-vm-primary hover:underline"
        >
          Ir a Vibemenu
        </a>
      </div>
    </main>
  );
}
