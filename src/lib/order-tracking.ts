export function buildTrackingUrl(publicCode: string, trackingToken: string) {
  return `/pedido/${encodeURIComponent(publicCode)}?token=${encodeURIComponent(trackingToken)}`;
}

export function reconcileTrackingSnapshot<T extends { version: number }>(current: T | null, incoming: T) {
  if (current && incoming.version < current.version) return current;
  return incoming;
}

export function classifyTrackingFailure(hasLoadedOrder: boolean, status?: number) {
  if (!hasLoadedOrder && (status === 401 || status === 404)) return "fatal" as const;
  return "retry" as const;
}
