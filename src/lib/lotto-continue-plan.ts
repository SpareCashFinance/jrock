export type FinishKind = "close" | "settle" | "claim" | "open" | "request_vrf" | "store_vrf" | string;

export function finishFlowPlan(kind: FinishKind, totalTickets: number, v2 = true) {
  if (kind === "close") {
    if (totalTickets === 0) return ["close", "open_next"] as const;
    return v2 ? (["close", "request_vrf"] as const) : (["close"] as const);
  }
  if (kind === "claim") return ["claim", "open_next"] as const;
  if (kind === "settle" || kind === "store_vrf") {
    return v2 ? (["settle", "claim", "open_next"] as const) : (["settle"] as const);
  }
  if (kind === "open") return ["open_current"] as const;
  if (kind === "request_vrf") return ["request_vrf"] as const;
  return [] as const;
}

export function finishFlowAsking(kind: FinishKind, totalTickets: number) {
  if (kind === "claim" || kind === "settle" || kind === "store_vrf") return "Paying winner and opening next rock…";
  if (kind === "close" && totalTickets === 0) return "Closing and opening next rock…";
  if (kind === "close") return "Closing and asking ORAO…";
  if (kind === "open") return "Opening round…";
  if (kind === "request_vrf") return "Asking ORAO…";
  return "Filing…";
}

export function finishFlowDone(kind: FinishKind, totalTickets: number) {
  if (kind === "claim" || kind === "settle" || kind === "store_vrf") return "Winner paid · next rock open";
  if (kind === "close" && totalTickets === 0) return "Next rock open";
  if (kind === "close") return "ORAO asked";
  if (kind === "open") return "Round open";
  if (kind === "request_vrf") return "ORAO asked";
  return "Done";
}
