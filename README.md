# Jamie’s Pet Rock (`$JROCK`)

Solana memecoin site for the pet rock that pays in Bitcoin. Official market is [StonkFun](https://www.stonkfun.xyz). Holder rewards are variable WBTC distributions from a Token-2022 transfer tax, not guaranteed income. A 60% launch buy-and-burn is planned.

Launch values (mint, socials, fees) live in `.env.example` / `src/lib/config.ts`.

Kennel lotto: [petrock.fun/lotto](https://petrock.fun/lotto). Independent chain check: [petrock.fun/lotto/verify](https://petrock.fun/lotto/verify) or `npm run verify:lotto`. Fairness spec: `docs/lotto-fairness.md`. Audit findings and launch decision: `docs/lotto-audit.md`. The live draw uses Solana SlotHashes after close; that is interim, not a VRF. Launch decision for a trustless production lottery is **FAIL**.
