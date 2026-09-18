export type FinishKind = "close" | "settle" | "claim" | "open" | "request_vrf" | "store_vrf" | string;

export function finishFlowPlan(kind: FinishKind, totalTickets: number) {
  if (kind === "close") return totalTickets === 0 ? (["close", "open_next"] as const) : (["close"] as const);
  if (kind === "claim") return ["claim", "open_next"] as const;
  if (kind === "settle") return ["settle"] as const;
  if (kind === "open") return ["open_current"] as const;
  if (kind === "request_vrf") return ["request_vrf"] as const;
  if (kind === "store_vrf") return ["store_vrf"] as const;
  return [] as const;
}

export function finishFlowAsking(kind: FinishKind, totalTickets: number) {
  if (kind === "claim") return "Paying winner and opening next rock…";
  if (kind === "close" && totalTickets === 0) return "Closing and opening next rock…";
  if (kind === "close") return "Closing sales…";
  if (kind === "settle") return "Settling…";
  if (kind === "open") return "Opening round…";
  if (kind === "request_vrf") return "Requesting VRF…";
  if (kind === "store_vrf") return "Reading ORAO…";
  return "Filing…";
}

export function finishFlowDone(kind: FinishKind, totalTickets: number) {
  if (kind === "claim") return "Winner paid · next rock open";
  if (kind === "close" && totalTickets === 0) return "Next rock open";
  if (kind === "close") return "Sales closed";
  if (kind === "settle") return "Draw settled";
  if (kind === "open") return "Round open";
  if (kind === "request_vrf") return "VRF requested";
  if (kind === "store_vrf") return "VRF stored";
  return "Done";
}
