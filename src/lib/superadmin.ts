/** Compartido entre /superadmin y /superadmin/$tenantId. */

export const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export const FECHA_HORA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const COLOR_ESTADO: Record<string, string> = {
  trial: "bg-vm-warning-soft text-vm-warning",
  activo: "bg-vm-success-soft text-vm-success",
  suspendido: "bg-vm-danger-soft text-vm-danger",
  cancelado: "bg-vm-danger-soft text-vm-danger",
};

export const NOMBRE_ESTADO: Record<string, string> = {
  trial: "Trial",
  activo: "Activo",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
};
