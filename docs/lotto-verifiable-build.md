# Verifiable build (jrock_lotto / jrock_lotto_v2)

Pin for reproducers:

| Tool | Version |
| --- | --- |
| Anchor | 0.31.1 (`anchor/Anchor.toml`) |
| `anchor-lang` | 0.31.1 |
| Solana / Agave (CI) | v4.2.2 |
| Rust edition | 2021 |
| Lockfile | `anchor/Cargo.lock` |

## v1 SlotHashes ELF (superseded as the live kennel)

- Program: `FvQfcJYAcRFEDeq8rS19MNXTZfeiCxcSN5nmfA6RdWuC`
- Program-data: `BZ2RWk6QZFspNKCHiESE7uYzfeCXMjpSvBJYgas26oWi`
- Upgrade authority: `62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq`
- Source tag: `lotto-v1-48h` (commit `80697656e27cab29ff1c8ceb3800c8c946cfa55d`)
- Upgrade tx: `27TSxFQi4fvJM6JbpydLZSztvb3QqXfwP5nhLunsZJKY97tn7DuhoswPa128u85FdiF1bRjfekJtqynp98TWHNWr`
- Explorer verified: **no**
- Round 0 is claimed. Do **not** upgrade this ELF while a funded round holds ticket SOL.

Verification of v1 does **not** make SlotHashes a VRF. It only proves the binary matches public source.

Program-only GitHub repo (required layout for `verify-from-repo`): https://github.com/SpareCashFinance/jrock-lotto

```
solana-verify verify-from-repo \
  https://github.com/SpareCashFinance/jrock-lotto \
  --program-id FvQfcJYAcRFEDeq8rS19MNXTZfeiCxcSN5nmfA6RdWuC \
  --library-name jrock_lotto \
  --commit-hash lotto-v1-48h
```

## v2 live ELF (ORAO VRF Classic)

- Program: `66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg`
- Program-data: `4MDqKt9HiM6oHCCbDSsadXuzDXteuhsJh3QJVniztqoA`
- Upgrade authority: `62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq`
- Config: `FBFL6W8ARdkhNM1WFhEfKHqw3HohacK1qhy9jhXQPLwv`
- Round 0 PDA: `6R2TdLtWQEqgUVe2yLnhf1GKX651JHja1yUfwEurL8st`
- Library name: `jrock_lotto_v2`
- Deploy tx: `3XM78ur9iR9iYihHT5bx1psMUD2Jc8ndtPeNYx4xjWFvXehG4wQ88KLGfySzKsTLU2zR3W7YPhU6uhg7UHhrJxK4`
- Initialize tx: `2jaAHhW6yD1qrFjg3W8CYFdSN4KUaZnDbvWxALBWrfY3wcWDxQWwc15SZJaXjkiQFvi5XVTFAYoJJU8XyVHqmNF9`
- Ticket: 50_000_000 lamports
- Round length: 172800 seconds (48h)
- VRF timeout: 21600 seconds (6h)
- Source commit: `da6775229249545330a6993c42d5d8b33b25d9f2` (256-buy book, `refund_one` disabled, `security_txt!`)
- OtterSec verification PDA: `7fYS1EP9gvC2if556WGtvCC8ZQUZYBuaKv3vdwYANRE4`
- PDA update tx: `4ndBvqJGG9M49rXgaCTuE9AegobMyLmE2U9ZPMtq2CFkshH2w1aiYWp5ppWhTYKtesdevpeqVXEuwn4vqcErho2Z`
- Uploader / upgrade authority: `62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq`
- Docker ELF sha256: `774bcde312fd66353cec9ae61378ca98ccf9c746e8afd7b029d35b403a78679f`
- OtterSec hash (on-chain = executable): `3c20014bff29c0b7271eb48bb378e4c5a1eecbab306b996299cba7c759df8d24`
- Explorer verified: **yes** (`is_verified: true`, commit `da67752`, job `d2b73a5e-3909-4397-884f-8480160a1d42`).
- Upgrade tx: `3N63rdjtmvjk6LdaR6LLWrDkF7v76vvZ4Dgi3kXsBhFGCVZbXsTmgj3HrJ6GwUYfDPk6tutxmsdqpwcZgh98ssUc`
- Deployed slot: `448205705`
- Book: 256 buy rows. Live round 0 realloced to 10686 bytes on the next buy.
- `refund_one` returns `RefundsDisabled` (6023). If anyone bought, settle always picks one of those wallets.
- Keep upgradeable. Do not revoke on day one.

```
solana-verify verify-from-repo \
  https://github.com/SpareCashFinance/jrock-lotto \
  --program-id 66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg \
  --library-name jrock_lotto_v2 \
  --commit-hash da6775229249545330a6993c42d5d8b33b25d9f2
```

Confirm the verified badge on Explorer and Solscan independently. Then either revoke upgrade authority or document Squads signers, threshold, and delay.

CI: `.github/workflows/build-lotto.yml` builds both SBF artifacts. OtterSec job: https://verify.osec.io/job/a200c041-4adc-46d3-990d-a728ede90f33. Status: https://verify.osec.io/status/66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg
