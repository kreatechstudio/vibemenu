import qrcode from "qrcode-generator";

/**
 * Imagen descargable de la tarjeta de lealtad. Es un recuerdo estático: se
 * dibuja con el avance de sellos al momento de descargar, pero una vez
 * guardada en el teléfono del cliente no vuelve a actualizarse — para eso
 * sigue existiendo la tarjeta viva en `/:slug/lealtad/:tarjetaId`.
 */
export type DatosTarjetaImagen = {
  negocio: string;
  premio: string;
  sellos: number;
  meta: number;
  codigo: string;
  colorPrimario: string;
  colorFondo: string;
  colorTexto: string;
};

const ANCHO = 1000;
const ALTO = 560;

function redondear(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** true si el color es tan claro que hace falta texto oscuro encima. */
function esClaro(hex: string): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

export function dibujarTarjetaLealtad(canvas: HTMLCanvasElement, datos: DatosTarjetaImagen): void {
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const sobrePrimario = esClaro(datos.colorPrimario) ? "#1C1917" : "#FFFFFF";

  // Fondo con la tarjeta "física": franja de color de marca arriba, cuerpo claro abajo.
  ctx.fillStyle = datos.colorFondo;
  redondear(ctx, 0, 0, ANCHO, ALTO, 28);
  ctx.fill();

  ctx.save();
  redondear(ctx, 0, 0, ANCHO, ALTO, 28);
  ctx.clip();
  ctx.fillStyle = datos.colorPrimario;
  ctx.fillRect(0, 0, ANCHO, 180);
  ctx.restore();

  ctx.fillStyle = sobrePrimario;
  ctx.font = "600 22px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("TARJETA DE LEALTAD", 48, 56);

  ctx.font = "700 42px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(datos.negocio, 48, 108);

  ctx.font = "400 20px 'Helvetica Neue', Arial, sans-serif";
  ctx.globalAlpha = 0.9;
  ctx.fillText(`Premio: ${datos.premio}`, 48, 148);
  ctx.globalAlpha = 1;

  // Rejilla de sellos.
  const meta = Math.max(1, datos.meta);
  const porFila = meta <= 10 ? meta : Math.ceil(meta / 2);
  const filas = Math.ceil(meta / porFila);
  const radio = 22;
  const espacio = 54;
  const anchoFila = (porFila - 1) * espacio;
  const inicioX = (ANCHO - anchoFila) / 2;
  const inicioY = 250;

  for (let i = 0; i < meta; i++) {
    const col = i % porFila;
    const fila = Math.floor(i / porFila);
    const cx = inicioX + col * espacio;
    const cy = inicioY + fila * espacio;
    const lleno = i < datos.sellos;
    ctx.beginPath();
    ctx.arc(cx, cy, radio, 0, Math.PI * 2);
    if (lleno) {
      ctx.fillStyle = datos.colorPrimario;
      ctx.fill();
    } else {
      ctx.lineWidth = 2;
      ctx.strokeStyle = datos.colorTexto;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  const alturaRejilla = filas * espacio;
  const yTrasRejilla = inicioY + alturaRejilla + 30;

  ctx.fillStyle = datos.colorTexto;
  ctx.font = "500 20px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center";
  const avance =
    datos.sellos >= meta
      ? `¡Completa! Enséñala para tu ${datos.premio}.`
      : `${datos.sellos} de ${meta} sellos`;
  ctx.fillText(avance, ANCHO / 2, yTrasRejilla);
  ctx.textAlign = "left";

  // QR + código, esquina inferior derecha.
  const qr = qrcode(0, "M");
  qr.addData(datos.codigo);
  qr.make();
  const qrLado = 150;
  const qrX = ANCHO - qrLado - 48;
  const qrY = ALTO - qrLado - 44;
  ctx.fillStyle = "#FFFFFF";
  redondear(ctx, qrX - 12, qrY - 12, qrLado + 24, qrLado + 24, 12);
  ctx.fill();
  const modulos = qr.getModuleCount();
  const celda = qrLado / modulos;
  ctx.fillStyle = "#000000";
  for (let r = 0; r < modulos; r++) {
    for (let c = 0; c < modulos; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(qrX + c * celda, qrY + r * celda, celda, celda);
    }
  }

  ctx.fillStyle = datos.colorTexto;
  ctx.font = "700 24px monospace";
  ctx.textAlign = "center";
  ctx.fillText(datos.codigo, qrX + qrLado / 2, qrY + qrLado + 36);
  ctx.textAlign = "left";

  ctx.fillStyle = datos.colorTexto;
  ctx.globalAlpha = 0.6;
  ctx.font = "400 14px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("Hecho con Vibemenu", 48, ALTO - 28);
  ctx.globalAlpha = 1;
}

export function descargarCanvasComoPng(canvas: HTMLCanvasElement, nombreArchivo: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}
