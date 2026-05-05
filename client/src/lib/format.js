export function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export const currency = formatCurrency;

export function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export const formatDuration = formatTime;
export const duration = formatTime;

export function formatTimeRange(startsAt, endsAt) {
  const options = { hour: "2-digit", minute: "2-digit" };
  return `${new Date(startsAt).toLocaleTimeString("fr-FR", options)} - ${new Date(endsAt).toLocaleTimeString("fr-FR", options)}`;
}

export const formatDateRange = formatTimeRange;
