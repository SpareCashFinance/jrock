export const JROCK_LOTTO_V2_PROGRAM_ID = "66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg";
export const ORAO_VRF_PROGRAM_ID = "VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y";

const ZERO = BigInt(0);
const ONE = BigInt(1);
const MAX_U64 = (ONE << BigInt(64)) - ONE;

function digestSource(data: Uint8Array) {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

export async function sha256Bytes(data: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", digestSource(data));
  return new Uint8Array(digest);
}

export async function vrfSeedBytes(programId: Uint8Array, roundPda: Uint8Array, roundId: number, ticketCount: number) {
  const roundBuf = new Uint8Array(8);
  new DataView(roundBuf.buffer).setBigUint64(0, BigInt(roundId), true);
  const countBuf = new Uint8Array(4);
  new DataView(countBuf.buffer).setUint32(0, ticketCount, true);
  const payload = new Uint8Array(programId.length + roundPda.length + roundBuf.length + countBuf.length);
  payload.set(programId, 0);
  payload.set(roundPda, programId.length);
  payload.set(roundBuf, programId.length + roundPda.length);
  payload.set(countBuf, programId.length + roundPda.length + roundBuf.length);
  return sha256Bytes(payload);
}

export async function winnerFromVrfEntropy(entropy: Uint8Array, ticketCount: number) {
  if (ticketCount <= 0) throw new Error("No slips.");
  if (ticketCount === 1) return { index: 0, used: toHex(entropy), hash: toHex(entropy) };
  const n = BigInt(ticketCount);
  let rem = (MAX_U64 % n) + ONE;
  if (rem === n) rem = ZERO;
  let seed = entropy.slice();
  for (let i = 0; i < 64; i += 1) {
    const x = new DataView(seed.buffer, seed.byteOffset, 8).getBigUint64(0, false);
    if (rem === ZERO || x < (ONE << BigInt(64)) - rem) {
      return { index: Number(x % n), used: toHex(seed), hash: toHex(seed) };
    }
    seed = await sha256Bytes(seed);
  }
  throw new Error("Rejection sampling failed.");
}

export function toHex(data: Uint8Array) {
  return [...data].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string) {
  const clean = hex.trim().toLowerCase();
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
