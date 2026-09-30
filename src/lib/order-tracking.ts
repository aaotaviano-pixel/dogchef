export function buildTrackingUrl(publicCode: string, trackingToken?: string) {
  const path = `/pedido/${encodeURIComponent(publicCode)}`;
  return trackingToken ? `${path}?token=${encodeURIComponent(trackingToken)}` : path;
}

export function reconcileTrackingSnapshot<T extends { version: number }>(current: T | null, incoming: T) {
  if (current && incoming.version < current.version) return current;
  return incoming;
}

export function reconcileOrderCollection<T extends { id: string; version: number }>(current: T[], incoming: T[]) {
  const currentById = new Map(current.map((order) => [order.id, order]));
  return incoming.map((order) => {
    const previous = currentById.get(order.id);
    return previous && previous.version > order.version ? previous : order;
  });
}

export function classifyTrackingFailure(hasLoadedOrder: boolean, status?: number) {
  if (!hasLoadedOrder && (status === 401 || status === 404)) return "fatal" as const;
  return "retry" as const;
}
