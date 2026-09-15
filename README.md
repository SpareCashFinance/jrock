# Jamie’s Pet Rock (`$JROCK`)

Solana memecoin site for the pet rock that pays in Bitcoin. Official market is [pump.fun](https://pump.fun). Holder rewards are variable WBTC distributions from trading fees, not guaranteed income. A 60% launch buy-and-burn is planned.

Launch values (mint, socials, fees) live in `.env.example` / `src/lib/config.ts`.

Kennel lotto: [petrock.fun/lotto](https://petrock.fun/lotto). Independent chain check: [petrock.fun/lotto/verify](https://petrock.fun/lotto/verify) or `node scripts/verify-lotto.mjs`. Fairness spec: `docs/lotto-fairness.md`. The live draw uses Solana SlotHashes after close; that is interim, not a VRF.
