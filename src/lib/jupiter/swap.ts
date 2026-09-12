import "server-only";

import { HOUSE_SWAP_FEE_BPS, JUPITER_REFERRAL_ACCOUNT } from "@/lib/solana";

const PAID_ORDER = "https://api.jup.ag/swap/v2/order";
const PAID_EXECUTE = "https://api.jup.ag/swap/v2/execute";
const LITE_QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const LITE_SWAP = "https://lite-api.jup.ag/swap/v1/swap";

export type JupiterEngine = "ultra" | "lite";

type OrderBody = {
  transaction?: string | null;
  requestId?: string;
  outAmount?: string;
  otherAmountThreshold?: string;
  inAmount?: string;
  errorMessage?: string;
  error?: string;
  errorCode?: number;
  router?: string;
  mode?: string;
  feeBps?: number;
  lastValidBlockHeight?: string | number;
};

function jupiterKey() {
  return process.env.JUPITER_API_KEY?.trim() || "";
}

function referralAccount() {
  return process.env.JUPITER_REFERRAL_ACCOUNT?.trim() || JUPITER_REFERRAL_ACCOUNT;
}

function referralFeeBps() {
  return String(Math.min(255, Math.max(50, HOUSE_SWAP_FEE_BPS)));
}

function withReferral(params: URLSearchParams) {
  const account = referralAccount();
  if (account) {
    params.set("referralAccount", account);
    params.set("referralFee", referralFeeBps());
  }
  return params;
}

function paidHeaders() {
  return { "x-api-key": jupiterKey(), accept: "application/json" };
}

async function paidOrder(params: URLSearchParams) {
  const res = await fetch(`${PAID_ORDER}?${params}`, {
    headers: paidHeaders(),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as OrderBody | null;
  if (!res.ok || !body?.outAmount) {
    throw new Error(body?.errorMessage || body?.error || "No Jupiter route for that pair.");
  }
  return body;
}

export async function quoteJupiterSwap(args: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}) {
  const slippageBps = String(Math.max(1, Math.round(args.slippageBps ?? 150)));
  if (jupiterKey()) {
    const order = await paidOrder(
      withReferral(
        new URLSearchParams({
          inputMint: args.inputMint,
          outputMint: args.outputMint,
          amount: args.amount,
          slippageBps,
        }),
      ),
    );
    return {
      outAmount: order.outAmount!,
      minOutAmount: order.otherAmountThreshold || order.outAmount!,
      router: order.router,
      feeBps: order.feeBps,
      engine: "ultra" as const,
      quoteResponse: undefined as Record<string, unknown> | undefined,
    };
  }

  const qs = new URLSearchParams({
    inputMint: args.inputMint,
    outputMint: args.outputMint,
    amount: args.amount,
    slippageBps,
    restrictIntermediateTokens: "true",
  });
  const res = await fetch(`${LITE_QUOTE}?${qs}`, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as
    | { error?: string; outAmount?: string; otherAmountThreshold?: string }
    | null;
  if (!res.ok || !body?.outAmount) {
    throw new Error(body?.error || "No Jupiter route for that pair.");
  }
  return {
    outAmount: body.outAmount,
    minOutAmount: body.otherAmountThreshold || body.outAmount,
    engine: "lite" as const,
    quoteResponse: body as Record<string, unknown>,
  };
}

export async function prepareJupiterSwap(args: {
  owner: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}) {
  const slippageBps = String(Math.max(1, Math.round(args.slippageBps ?? 150)));
  if (jupiterKey()) {
    const order = await paidOrder(
      withReferral(
        new URLSearchParams({
          inputMint: args.inputMint,
          outputMint: args.outputMint,
          amount: args.amount,
          taker: args.owner,
          slippageBps,
        }),
      ),
    );
    if (!order.transaction || !order.requestId) {
      throw new Error(order.errorMessage || "Jupiter quoted a price but could not build the swap.");
    }
    return {
      tx: order.transaction,
      requestId: order.requestId,
      outAmount: order.outAmount!,
      minOutAmount: order.otherAmountThreshold || order.outAmount!,
      lastValidBlockHeight: order.lastValidBlockHeight ? String(order.lastValidBlockHeight) : undefined,
      execute: true,
      engine: "ultra" as const,
    };
  }

  const quoted = await quoteJupiterSwap(args);
  const quoteResponse = quoted.quoteResponse;
  if (!quoteResponse) throw new Error("Missing Jupiter quote.");
  const res = await fetch(LITE_SWAP, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: args.owner,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 2_000_000,
          priorityLevel: "high",
        },
      },
    }),
  });
  const body = (await res.json().catch(() => null)) as { swapTransaction?: string; error?: string } | null;
  if (!res.ok || !body?.swapTransaction) {
    throw new Error(body?.error || "Jupiter could not build that swap.");
  }
  const outAmount = typeof quoteResponse.outAmount === "string" ? quoteResponse.outAmount : undefined;
  const minOutAmount =
    typeof quoteResponse.otherAmountThreshold === "string"
      ? quoteResponse.otherAmountThreshold
      : outAmount;
  return { tx: body.swapTransaction, execute: false, outAmount, minOutAmount, engine: "lite" as const };
}

export async function executeJupiterSwap(args: {
  signedTransaction: string;
  requestId: string;
  lastValidBlockHeight?: string;
}) {
  if (!jupiterKey()) throw new Error("JUPITER_API_KEY is not set.");
  const payload: Record<string, string> = {
    signedTransaction: args.signedTransaction,
    requestId: args.requestId,
  };
  if (args.lastValidBlockHeight) payload.lastValidBlockHeight = args.lastValidBlockHeight;
  const res = await fetch(PAID_EXECUTE, {
    method: "POST",
    headers: { ...paidHeaders(), "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as {
    status?: string;
    signature?: string;
    error?: string;
    code?: number;
    totalOutputAmount?: string;
    outputAmountResult?: string;
  } | null;
  if (body?.status === "Success" && body.signature) {
    return {
      signature: body.signature,
      outAmount: body.totalOutputAmount || body.outputAmountResult || "",
      engine: "ultra" as const,
    };
  }
  throw new Error(body?.error || `Jupiter could not land that swap${body?.code != null ? ` (${body.code})` : ""}.`);
}

export function jupiterEngine(): JupiterEngine {
  return jupiterKey() ? "ultra" : "lite";
}
