# DeXa — USSD & WhatsApp Hedera Last‑Mile Access in the Global South

<p align="center">
  <img src="ussd/src/assets/dexa-logo.svg" alt="DeXa Logo" width="140" />
</p>

<p align="center">
  <a href="https://hedera.com"><img alt="Powered by Hedera" src="https://img.shields.io/badge/Powered%20by-Hedera-black"></a>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-18%2B-3C873A?logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white">
  <img alt="Twilio WhatsApp" src="https://img.shields.io/badge/Twilio-WhatsApp-FF0000?logo=twilio&logoColor=white">
  <a href="dexa-whatsapp/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-Apache%202.0-blue"></a>
</p>

[📄 View the Pitch Deck (PDF)](./documents/pitch.pdf)

[📄 View the Developer Certificate (PDF)](./documents/devcert.pdf)

DeXa brings Hedera (EVM) to people with no internet or very low bandwidth by using familiar channels: USSD and WhatsApp. The project enables secure wallet creation, balance checks, and payments using simple menus (USSD) or natural language chat (WhatsApp), with multi‑language support and low fees on Hedera Testnet/Mainnet.

---

## Repository layout

- `ussd/` — Vite + React UI for showcasing the USSD/SMS experience and related assets. Includes a placeholder backend folder for USSD/SMS gateways.
- `whatsapp/` — TypeScript Node service integrating Twilio WhatsApp, Prisma/PostgreSQL, and Hedera EVM (ethers v6). Includes tests and simple contract tooling.



<p align="center">
  <img src="ussd/src/assets/dexa2.png" alt="DeXa architecture overview" width="640" />
</p>

---

## Key capabilities

- USSD wallet flows: create, view, secure, delete (PIN protected)
- SMS/NLP assistant for blockchain queries and actions
- WhatsApp payments: P2P, phone-based identity mapping, group payments, refunds (WIP)
- Multi‑language UX (e.g., English, French, Kiswahili)
- Hedera EVM settlement (HBAR), very low fees, rapid finality

---

## System Architecture

```
┌───────────────────────┐                    ┌────────────────────┐
│ Feature phone user    │                    │ Smartphone user     │
│ (USSD/SMS)            │                    │ (WhatsApp)         │
└──────────┬────────────┘                    └─────────┬──────────┘
           │ USSD/SMS                                   │ WhatsApp
           ▼                                            ▼
┌──────────────────────────────┐             ┌─────────────────────────┐
│ USSD/SMS Gateway             │             │ Twilio WhatsApp API     │
│ (e.g., Africa's Talking)     │◄───────────►│ (webhooks + outbound)   │
└──────────┬───────────────────┘             └──────────┬──────────────┘
           │ HTTP (USSD callbacks)                      │ Webhook POST
           ▼                                            ▼
┌──────────────────────────────┐             ┌─────────────────────────┐
│ USSD Backend                 │             │ WhatsApp Bot Service    │
│ (Node/Express, MongoDB)      │             │ (Node/TS, Express,      │
│                              │             │  Prisma, PostgreSQL)    │
└──────────┬───────────┬───────┘             └──────────┬──────────────┘
           │           └─────► MongoDB                 PostgreSQL ◄────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Hedera EVM                                                           │
│ (JSON-RPC via ethers.js, Hashio RPC; optional smart contracts)       │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
WhatsApp P2P Payment (HBAR)

[User] -> [WhatsApp] -> [Twilio] -> [WhatsApp Bot]
                                  |
                                  v
                             [PostgreSQL]
                                  |
                                  v
                        (ethers.js JSON-RPC)
                                  |
                               [Hedera EVM]
                                  |
                                  v
[User] <- [Twilio] <- [WhatsApp Bot] (tx receipt persisted + outbound reply)


USSD HBAR Send

[Feature Phone] -> [USSD/SMS Gateway] -> [USSD Backend]
                                         |           \
                                         v            \
                                     [MongoDB]         \
                                                        v
                                         (ethers.js JSON-RPC)
                                                        |
                                                     [Hedera EVM]
                                                        |
                                                        v
[Feature Phone] <- [USSD/SMS Gateway] <- [USSD Backend] (tx status + reply)
```

---

## Prerequisites

- Node.js 18+
- Package managers:
  - dexa-ussd uses npm (package-lock.json present)
  - dexa-whatsapp uses pnpm (pnpm-lock, packageManager field)
- PostgreSQL (for dexa-whatsapp)
- Twilio account with WhatsApp Business API (for dexa-whatsapp)

Optional (for smart contract deployment/tests):
- A funded Hedera Testnet account private key

---

## Quick start

1) Clone and enter the repo

```bash
git clone https://github.com/dexadexa/dexa
cd dexa
```

2) USSD demo app (UI)

```bash
cd ussd
npm install
npm run dev
# open the printed URL (Vite dev server)
```

3) WhatsApp bot (backend)

```bash
cd whatsapp
pnpm install

# Copy or create .env and fill values (see Environment below)
# Example (Linux/macOS):
cp .env.example .env 2>/dev/null || true

# Initialize Prisma client and DB schema (PostgreSQL must be reachable)
pnpm prisma:generate
pnpm prisma:migrate

# Run the service (hot reload) or build+start
pnpm dev
# or
pnpm build && pnpm start
```

---

## Environment configuration (dexa-whatsapp)

The service validates environment variables at startup (see `src/config/env.ts`). Required/important keys:

- DATABASE_URL — PostgreSQL connection string
- TWILIO_ACCOUNT_SID — Twilio account SID
- TWILIO_AUTH_TOKEN — Twilio auth token
- TWILIO_WHATSAPP_NUMBER — must include the `whatsapp:+` prefix (e.g., `whatsapp:+14155238886`)
- ENCRYPTION_SECRET — at least 32 chars; used for encrypting sensitive data

Hedera/EVM:
- HEDERA_RPC — default `https://testnet.hashio.io/api`
- HEDERA_CHAIN_ID — default `296` (Hedera Testnet)
- USER_REGISTRY_ADDRESS — deployed contract address if using on‑chain phone→address mapping; defaults to zero address

Optional operational values:
- PORT — HTTP port (default 3000)
- WEBHOOK_URL — full public URL used for Twilio webhook signature verification
- SESSION_TTL_MINUTES — default 10
- CONFIRMATION_TIMEOUT_SECONDS — default 120

Testing/dev helpers:
- HEDERA_FAUCET_PK — funded Testnet private key to allow programmatic funding in dev/tests
- HEDERA_ADMIN_PK — optional admin key for contract methods (falls back to faucet if not provided)


### Example .env (dexa-whatsapp)

```env
# Runtime
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dexa

# Twilio WhatsApp Business API
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Public webhook URL used for signature verification (must match Twilio console)
WEBHOOK_URL=http://localhost:3000/webhooks/twilio/whatsapp

# Hedera EVM
HEDERA_RPC=https://testnet.hashio.io/api
HEDERA_CHAIN_ID=296
USER_REGISTRY_ADDRESS=0x0000000000000000000000000000000000000000

# Crypto/key management
ENCRYPTION_SECRET=please_set_a_strong_random_string_at_least_32_chars

# Timeouts/session
SESSION_TTL_MINUTES=10
CONFIRMATION_TIMEOUT_SECONDS=120

# Optional (dev/testing)
HEDERA_FAUCET_PK=0x...
HEDERA_ADMIN_PK=0x...
# For contract deployment scripts
DEPLOYER_PK=0x...
```

Note: Update WEBHOOK_URL to the exact public URL Twilio will call (including path). Ensure your server listens on that path.

---

## WhatsApp/Twilio webhook setup

- Expose the running service publicly (e.g., with a reverse proxy or tunneling during dev)
- Configure Twilio WhatsApp sandbox/number to POST to your webhook endpoint
- Use signature verification with Twilio’s `X-Twilio-Signature` header (implemented in `src/security/twilioValidator.ts`)
- Outbound messages are sent with `Twilio` SDK using `TWILIO_WHATSAPP_NUMBER`

Note: A production‑grade webhook route and message handling pipeline live under `dexa-whatsapp/src` (bot, parsing, session handling, etc.).


### Step-by-step: Configure Twilio WhatsApp webhooks

1) Run the backend service
- In dexa-whatsapp: `pnpm dev` (defaults to http://localhost:3000)

2) Expose a public URL (for local development)
- Use your preferred tunnel or reverse proxy to expose `http://localhost:3000` (e.g., `https://<your-subdomain>.tld`)

3) Choose your inbound webhook path
- Example: `POST /webhooks/twilio/whatsapp`
- Set `WEBHOOK_URL` in `.env` to the full public URL, e.g., `https://<your-domain>/webhooks/twilio/whatsapp`

4) Configure Twilio Console
- Go to Messaging → WhatsApp → Sandbox (or your WhatsApp Sender)
- Set “WHEN A MESSAGE COMES IN” to your `WEBHOOK_URL`
- HTTP Method: POST; Content Type: application/x-www-form-urlencoded

5) Set required environment variables
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` (must start with `whatsapp:+`)
- `WEBHOOK_URL` must match the exact URL configured in Twilio (used for signature verification)

6) Implement/verify the webhook route in your code
- Validate the Twilio signature using `src/security/twilioValidator.ts` (`verifyTwilioRequest`)
- Build responses with `twiml.MessagingResponse` (see `buildMessagingResponse`)
- Send outbound messages via `src/bot/twilioClient.ts`

7) Test
- From your Twilio WhatsApp sandbox, send a message to your configured number
- Watch service logs to confirm signature verification and replies

Tip: In production, ensure HTTPS, IP allowlists (if required), proper secrets management, and retry handling.

---

## Smart contracts

Basic scripts are provided to compile and deploy an example `UserRegistry` Solidity contract (for phone→address mapping):

```bash
# From whatsapp/
# 1) Compile
pnpm compile:hedera

# 2) Deploy (requires DEPLOYER_PK with HBAR on Hedera Testnet)
DEPLOYER_PK=0x... pnpm deploy:hedera

# After deployment, set USER_REGISTRY_ADDRESS in .env
```

Artifacts are stored in `whatsapp/artifacts/`. The bot can read `USER_REGISTRY_ADDRESS` to switch from the in‑memory stub to on‑chain registry.

---

## Testing

- Unit tests (Vitest) are set up in `whatsapp`:

```bash
cd whatsapp
pnpm test         # run once
pnpm test:watch   # watch mode
```

- The test environment loader uses `vitest.setup.ts` and `.env.test` if present.
- Some integration scripts (e.g., `test-p2p-payment.js`) can be run with `NETWORK=hedera` to exercise Hedera paths.

---

## Development notes

- ussd: Vite + React 19 (see `ussd/package.json`); lint with `npm run lint`.
- whatsapp: Node + TypeScript; lint/format/test via scripts in `package.json`.
- Database schema lives in `whatsapp/prisma/schema.prisma`; run migrations when schema changes.

---

## Security and privacy

- Never commit secrets; use environment variables or secret managers.
- Keep ENCRYPTION_SECRET strong (>= 32 chars). Private keys should only be used in secure dev/test environments.
- Validate Twilio webhook signatures in production deployments.

---

## Roadmap

- Enriched USSD production backend via regional gateways
- Full group treasury and refunds on Hedera contracts
- Country‑specific fiat on/off ramps (UPI, PIX, M‑Pesa, etc.)
- Expanded language support and accessibility features

---

## Licenses

- `whatsapp/`: Apache‑2.0
- `ussd/`: MIT

See individual subproject LICENSE files where applicable.

---

## Contributing

Issues and PRs are welcome. Please keep changes scoped to one subproject when possible and include tests for backend changes.

---

## Acknowledgements

- Hedera Hashgraph community and tooling
- Twilio (WhatsApp Business API)
- Africa’s Talking and regional USSD/SMS providers
- Open source ecosystem (TypeScript, Vite, Prisma, Ethers, Vitest)

