import type { DeliveryZone, WorkingHour } from "@/lib/types";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";

export function normalizeNeighborhood(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function findDeliveryZone(neighborhood: string, zones: DeliveryZone[]) {
  const normalized = normalizeNeighborhood(neighborhood);
  return zones.find(
    (zone) =>
      zone.isAvailable &&
      zone.aliases.some((alias) => normalizeNeighborhood(alias) === normalized),
  );
}

function minute(time: string) {
  const [hour, minutes] = time.split(":").map(Number);
  return hour * 60 + minutes;
}

export function isStoreOpen(now: Date, workingHours: WorkingHour[]) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part("weekday"));
  const minutes = Number(part("hour")) * 60 + Number(part("minute"));
  return workingHours.some((slot) => {
    if (slot.weekday !== weekday || slot.isClosed) return false;
    const opensAt = minute(slot.opensAt);
    const closesAt = minute(slot.closesAt);
    return closesAt >= opensAt ? minutes >= opensAt && minutes <= closesAt : minutes >= opensAt || minutes <= closesAt;
  });
}
