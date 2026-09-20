export type FinishKind = "close" | "settle" | "claim" | "open" | "request_vrf" | "store_vrf" | string;

export function finishFlowPlan(kind: FinishKind, totalTickets: number, v2 = true): string[] {
  if (kind === "close") {
    if (totalTickets === 0) return ["close", "open_next"];
    return v2 ? ["close", "request_vrf"] : ["close"];
  }
  if (kind === "claim") return ["claim", "open_next"];
  if (kind === "settle" || kind === "store_vrf") {
    return v2 ? ["settle", "claim", "open_next"] : ["settle"];
  }
  if (kind === "open") return ["open_current"];
  if (kind === "request_vrf") return ["request_vrf"];
  return [];
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
