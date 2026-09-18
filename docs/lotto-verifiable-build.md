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
- Source commit: `35de5008f9a5f7746b712386bf77d2cfd39d7db3` (10,000-buy book, `compact_book`, leftover realloc rent stays in the pot)
- OtterSec verification PDA: `7fYS1EP9gvC2if556WGtvCC8ZQUZYBuaKv3vdwYANRE4`
- Uploader / upgrade authority: `62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq`
- Explorer verified: **yes** (`is_verified: true`, commit `35de500`, job `86894fa3-3923-4deb-a90c-7458661bb29a`).
- Upgrade tx: `3ifa1s7RFBELfRdCN57ShgADeFyPGJSHvn6D8LvwTusfin3ifLaX2ScyZnvCAGQKbTtjNTghKQyUUxRLM3RZTmnS`
- Deployed slot: `448216595`
- Book: 10,000 buy rows. The live account grows with each buy and shrinks unused reserved rows so leftover rent stays in the pot.
- `refund_one` returns `RefundsDisabled` (6023). If anyone bought, settle always picks one of those wallets.
- Keep upgradeable. Do not revoke on day one.

```
solana-verify verify-from-repo \
  https://github.com/SpareCashFinance/jrock-lotto \
  --program-id 66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg \
  --library-name jrock_lotto_v2 \
  --commit-hash 35de5008f9a5f7746b712386bf77d2cfd39d7db3
```

Confirm the verified badge on Explorer and Solscan independently. Then either revoke upgrade authority or document Squads signers, threshold, and delay.

CI: `.github/workflows/build-lotto.yml` builds both SBF artifacts. OtterSec job: https://verify.osec.io/job/86894fa3-3923-4deb-a90c-7458661bb29a. Status: https://verify.osec.io/status/66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg
