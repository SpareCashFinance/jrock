# jrock_lotto

On-chain kennel lotto for `$JROCK`. The round account holds the pot. The winner takes 85%. Fifteen percent stays and rolls into the next round. 1% of each 0.05 SOL slip is the kennel fee to `qbjbLafSNGq27fYFiF1RKhb9BREk1zFWWS8H6Drj8co`; 99% goes in the pot.

Program id: `FvQfcJYAcRFEDeq8rS19MNXTZfeiCxcSN5nmfA6RdWuC`

**Do not upgrade this program while round 0 holds player SOL.** Snapshot: `docs/lotto-v1-snapshot.md`.

Successor `jrock_lotto_v2` (`66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg`) is a new program id. Spec: `docs/lotto-fairness-v2.md`. Verifiable build: `docs/lotto-verifiable-build.md`.

## What it does

1. `initialize` — authority sets ticket price, round length, and slot lag, and opens round 0.
2. `buy` — 1 to 20 slips. Buyer pays the posted slip price. 1% is the kennel fee to `qbjbLafSNGq27fYFiF1RKhb9BREk1zFWWS8H6Drj8co`. 99% moves into the round account.
3. `close_sales` — after `end_ts`. If nobody bought, the round is void. Otherwise it locks `entropy_slot = now + lag`.
4. `settle` — reads that exact SlotHashes entry and picks `sha256(slot_hash || round_id || ticket_count) % slips`.
5. `claim` — pays 85% of the pot (minus rent) to the winner. 15% stays on the round account.
6. `open_round` — starts the next round after a claim or void, and moves the leftover 15% into the new pot.

Anyone can crank close, settle, claim, and open. Settle must happen within a few minutes of the entropy slot or SlotHashes forgets it. This is an interim SlotHashes design, not a VRF. Full spec: `docs/lotto-fairness.md`. Independent check: `node scripts/verify-lotto.mjs`.

## Deploy

Install Solana CLI and [Anchor 0.31.1](https://www.anchor-lang.com/docs/installation). Use a wallet with enough SOL for the program account (~2 SOL on mainnet, less on devnet).

If `target/deploy/jrock_lotto-keypair.json` is missing, make a new one and sync the id into `programs/jrock_lotto/src/lib.rs`, `Anchor.toml`, and `NEXT_PUBLIC_LOTTO_PROGRAM` on the site:

```
solana-keygen new -o target/deploy/jrock_lotto-keypair.json --no-bip39-passphrase
anchor keys sync
```

Then:

```
anchor build
anchor deploy --provider.cluster mainnet
```

Initialize once from the upgrade-authority wallet (0.05 SOL tickets, 48h rounds, ~150 slot lag):

```
ticket_lamports = 50_000_000
round_secs = 172800
lag_slots = 150
```

Live v1 was initialized at 72 hours (`259200`). That value lives on the config PDA. The current rock's `end_ts` is already written. Shortening later rocks to 48 hours needs `set_round_secs` after a safe upgrade — do not replace the live ELF while a round PDA holds player SOL.

Set `NEXT_PUBLIC_LOTTO_PROGRAM` to the program id on Vercel. The site reads the config PDA and switches off wallet-pot mode by itself. Keep upgrade authority on the kennel wallet.
