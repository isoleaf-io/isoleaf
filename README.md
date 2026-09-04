# ISOLeaf — ISO 8583 & ISO 20022 Toolkit

> Parse, build, simulate and debug ISO 8583 and ISO 20022 messages — all in one place.

[![License: ELv2](https://img.shields.io/badge/License-ELv2-blue.svg)](./LICENSE)
[![.NET](https://img.shields.io/badge/.NET-9.0-purple.svg)](https://dotnet.microsoft.com)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](https://ghcr.io/isoleaf-io/isoleaf-backend)

> ### ⚠️ Breaking change in v3.0.0
>
> The single `isoleaf` process was split into two: **`isoleaf-backend`**
> (SPA + utility APIs, port **8080**) and **`isoleaf-agent`** (Simulator +
> SignalR + TCP listeners, port **8583**). Each ships as its own Docker
> image and its own portable folder.
>
> **What you need to do to upgrade a self-hosted install:**
> - Swap `docker run ghcr.io/isoleaf-io/isoleaf:latest` for **two** containers
>   (`isoleaf-backend` and `isoleaf-agent`) — the simplest path is the new
>   `docker-compose.standalone.yml`, which wires both up on the same network.
> - After both are up, open http://localhost:8080, go to **Workspace →
>   Simulador** tab and click **Conectar** — the field is pre-filled with
>   `http://localhost:8583` (the Agent URL). This saves the URL in your
>   browser's `localStorage`; it's a per-browser setting, not server state.
>
> The old `ghcr.io/isoleaf-io/isoleaf` image is **not** published from v3
> onwards. Existing tags (v2.1.x) remain available.

---

## What is ISOLeaf?

ISOLeaf is a standalone developer toolkit for engineers working with card-network
payment protocols (ISO 8583) and financial-messaging XML protocols (ISO 20022 —
covering Brazilian Pix, SWIFT CBPR+, SEPA and TARGET/T2). It runs entirely on
your machine — no cloud, no sign-up, no data leaves your environment.

### ISO 8583 Modules

| Module | Description |
|--------|-------------|
| **Parser** | Decode ISO 8583 messages — ASCII wire, binary-hex, with or without TPDU |
| **Builder** | Generate complete ISO 8583 messages by transaction context (role, brand, channel) |
| **Bitmap** | Interactively decode and construct bitmaps |
| **EMV / Cryptography** | Parse Bit 55 TLV, validate ARQC, generate ARPC, run Full EMV Flow |
| **TCP Simulator** | Listen and auto-respond (rebatedor) or connect and inject (injector) |
| **Test Card Generator** | Generate valid test PANs, tracks and CVV by brand |
| **Workspace** | Local key management — configure IMK/ZPK for real ARQC generation |

### ISO 20022 Modules

| Module | Description |
|--------|-------------|
| **XML Parser** | Decode any ISO 20022 message — auto-detects family and version by namespace |
| **Field Reference** | Browse the XSD tree per message and cross-search fields across every family and version |
| **XSD Validator + Version Comparator** | Validate against the schema and diff two versions of the same type |
| **Builder (5 ecosystems)** | Generate messages for Brazilian Pix, SEPA, SWIFT CBPR+, TARGET/T2 or Generic |
| **Pix QR Code** | Decode and generate Pix Copia-e-Cola payloads (EMV-MPM) with CRC-16 validation |
| **Flow Visualizer** | Cross-protocol sequence diagram — Pix, CBPR+ MX/MT and ISO 8583 |
| **MT Parser** | Parse legacy SWIFT MT103 / MT202 / MT202COV messages block by block |
| **MT ↔ MX Comparator** | Convert MT into pacs.008/pacs.009 and diff field by field with confidence levels |
| **Workspace Schemas** | Upload custom XSDs — SchemaRegistry reloads live, no restart |

---

## Screenshots

### Parser
![Parser](frontend/isohub/public/screenshots/parse1.png)

### Builder
![Builder](frontend/isohub/public/screenshots/builder.png)

### Simulator
![Simulator](frontend/isohub/public/screenshots/simulator.png)

### EMV Data
![EMV Data](frontend/isohub/public/screenshots/emv1.png)

### ISO 20022 Builder
![ISO 20022 Builder](frontend/isohub/public/screenshots/iso20022/builder.png)

### Cross-Protocol Flow Visualizer
![Cross-Protocol Flow Visualizer](frontend/isohub/public/screenshots/iso20022/flow-visualizer.png)

### MT ↔ MX Comparator
![MT ↔ MX Comparator](frontend/isohub/public/screenshots/iso20022/comparador-mt-mx.png)

---

## Quick Start

Since v3.0, ISOLeaf runs as **two processes**: `isoleaf-backend` on port
`8080` (SPA + utility APIs) and `isoleaf-agent` on port `8583` (Simulator +
SignalR + TCP listeners). All the quick-start options below spin up both.

### Option 1 — Docker Compose (recommended)

```bash
git clone https://github.com/isoleaf-io/isoleaf.git
cd isoleaf
docker compose -f docker-compose.standalone.yml up
```

Then:

1. Open [http://localhost:8080](http://localhost:8080).
2. Navigate to **Workspace → Simulador**, confirm the pre-filled Agent URL
   (`http://localhost:8583`) and click **Conectar**. The URL is stored in
   your browser's `localStorage`, one-time per browser profile.

The compose file exposes `8080`, `8583`, `9100`, `9200`, mounts an
`isoleaf-data` volume at `/app/data` (Backend-side XSD persistence), and
runs `/api/health` healthchecks on both containers. Add or remove TCP
ports on the `agent` service to match the Simulator ports you plan to
use — the default in the "Nova sessão" form is `9100`.

### Option 2 — Docker (two containers, no compose)

```bash
# Create a shared network so the Backend can reach the Agent by hostname.
docker network create isoleaf-net

# Backend (port 8080) — serves the SPA and the utility APIs.
docker run -d --name isoleaf-backend --network isoleaf-net \
  -p 8080:8080 -e AGENT_URL_HINT=http://localhost:8583 \
  ghcr.io/isoleaf-io/isoleaf-backend:latest

# Agent (port 8583) — Simulator REST + SignalR + TCP listeners.
docker run -d --name isoleaf-agent --network isoleaf-net \
  -p 8583:8583 -p 9100:9100 \
  ghcr.io/isoleaf-io/isoleaf-agent:latest
```

Open [http://localhost:8080](http://localhost:8080) and follow step 2 above.

### Option 3 — Build from source

**Requirements:**
- [.NET 9 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org)

```bash
git clone https://github.com/isoleaf-io/isoleaf.git
cd isoleaf

# Build frontend (drops into agent/Iso8583Toolkit.Backend/wwwroot)
cd frontend/isohub
npm install
npm run build

# Terminal 1 — Backend on http://localhost:8080
cd ../../agent/Iso8583Toolkit.Backend
dotnet run

# Terminal 2 — Agent on http://localhost:8583
cd agent/Iso8583Toolkit.Agent
dotnet run
```

Open [http://localhost:8080](http://localhost:8080) and follow step 2 of
Option 1 to point the SPA at the Agent.

### Option 4 — Portable (no Docker, no git required)

For environments where Docker is blocked but .NET is already available on
developer workstations — common in enterprise setups with locked-down runtime
policies.

**Prerequisite:** only the [.NET 9 Runtime](https://dotnet.microsoft.com/download/dotnet/9.0)
(the full SDK is *not* required — the runtime alone is enough to launch a
framework-dependent build).

1. Grab `isoleaf-portable-vX.Y.Z.zip` from the
   [Releases page](https://github.com/isoleaf-io/isoleaf/releases).
2. Extract anywhere.
3. Launch — the script starts **both** the Backend (`:8080`) and the Agent (`:8583`):
   - **Windows** — double-click `run.bat` (opens two console windows).
   - **macOS / Linux** — `./run.sh` from a Terminal (single window, both processes; Ctrl+C stops both).
4. Open [http://localhost:8080](http://localhost:8080), then Workspace →
   Simulador → **Conectar** (Agent URL pre-filled with `http://localhost:8583`).

The same zip runs on Windows, macOS and Linux — no per-OS build. Every feature
present in the Docker image is available (Simulator, EMV crypto, custom XSD
uploads, etc.).

---

## API

ISOLeaf exposes a REST API for integration with automated test tools
and data generation pipelines. Available in self-hosted (Docker) mode only.

Interactive documentation (Scalar UI, Backend-side only):
http://localhost:8080/api/docs

### Key endpoints

Since v3.0 the API surface is split across two hosts. Everything on the
**Backend** (`:8080`) is single-request/response; **Agent** endpoints
(`:8583`) drive the live TCP Simulator + WebSocket log.

| Host | Endpoint | Description |
|---|---|---|
| Backend `:8080` | `POST /api/parse/hex` | Parse an ISO 8583 message from hex, ASCII-wire or binary-hex |
| Backend `:8080` | `POST /api/emv/parse-bit55` | Parse BER-TLV EMV data from Bit 55 |
| Backend `:8080` | `POST /api/cards/generate` | Generate a synthetic Luhn-valid test card |
| Backend `:8080` | `POST /api/emv/generate-arqc` | Compute the ARQC cryptogram |
| Backend `:8080` | `POST /api/emv/generate-arpc` | Compute the ARPC (issuer response cryptogram) |
| Backend `:8080` | `POST /api/iso20022/builder/build` | Generate an ISO 20022 message from an ecosystem + scenario cascade |
| Backend `:8080` | `GET  /api/test-data/person` | Return a fake person fixture (name, CPF, e-mail, Pix phone) |
| Backend `:8080` | `POST /api/iso20022/validate` | Validate an ISO 20022 XML against its embedded XSD |
| Backend `:8080` | `POST /api/swift/mt/parse` | Parse a SWIFT MT103 / MT202 / MT202COV message |
| Backend `:8080` | `POST /api/pix/qrcode/generate` | Generate a Pix Copia-e-Cola payload (EMV-MPM with CRC-16) |
| **Agent** `:8583` | `GET  /api/simulator/sessions` | List running Simulator sessions |
| **Agent** `:8583` | `POST /api/simulator/sessions` | Start a new Rebatedor / Injetor session |
| **Agent** `:8583` | `POST /api/simulator/inject-direct` | Fire-and-await: connect, send one ISO 8583 frame, read the reply |
| **Agent** `:8583` | `GET  /api/simulator/log` | Read the cross-session Simulator message log |
| **Agent** `:8583` | `WS   /hubs/simulator` | SignalR hub — live message + session events |

### Quick example

```bash
# Parse an ISO 8583 message
curl -X POST http://localhost:8080/api/parse/hex \
  -H "Content-Type: application/json" \
  -d '{"hex": "0100723800000000000000000000"}'

# Generate a test card
curl -X POST http://localhost:8080/api/cards/generate \
  -H "Content-Type: application/json" \
  -d '{"brand": "Visa"}'
```

> ⚠️ Do not send real cardholder data or production keys to external
> servers. Run ISOLeaf locally for sensitive operations.

---

## Features

### Parser
- Auto-detects ASCII wire, binary-hex, and TPDU prefix
- Displays all decoded fields with masking for sensitive data (PAN, PIN Block)
- One-click navigation to Builder, Bitmap, or EMV modules
- Export parsed result as JSON

### Builder
- Smart generation by role (Acquirer, Network, Issuer), brand, channel, and transaction type
- Real ARQC cryptogram when IMK is configured in Workspace
- Persistent templates via localStorage
- One-click reversal (generates 0400 with Bit 90 populated)

### EMV Cryptography
- Parse Bit 55 BER-TLV with partial parse support (no 400 errors on truncated data)
- Proprietary header skip (configurable byte offset)
- Validate ARQC against Issuer Master Key
- Generate ARPC (Method 1 and 2)
- Build Bit 55 response (tags 91 + 8A)
- Full EMV Flow: validate → generate ARPC → build response in one step
- Supports Visa CVN 10/18, Mastercard M/Chip, Elo profiles

### TCP Simulator
- **Rebatedor**: listens on a TCP port and auto-responds to incoming messages
- **Injector**: connects to an external system and sends messages
  - Single injection or continuous mode (1 msg/s, low load)
  - Vary identifiers (STAN, DateTime, RRN) per send
  - Vary transaction amount within a configured range
- Unknown MTI policy: Derive automatically, Reject, Echo, or Custom MTI
- TPDU mode: Optional, Required, Strip, or Auto
- Live log with per-session filtering

### ISO 20022
- **Multi-Ecosystem Builder** — five ready-made ecosystems with regulator-compliant defaults:
  - **Brazilian Pix** (SPI/BCB) — 32-char EndToEndId, ISPB, TxId per BCB Standards Manual
  - **SEPA** — IBAN, euro-area purpose codes and cardinalities
  - **SWIFT CBPR+** — BIC + UETR, cover payments (pacs.009), Debtor/Creditor agents
  - **TARGET/T2** — Eurosystem RTGS variant
  - **Generic** — any loaded XSD (including custom uploads from Workspace)
- **Cross-Protocol Flow Visualizer** — sequence diagrams for Pix (PSP → SPI → PSP), SWIFT CBPR+ (MX and legacy MT) and ISO 8583; each arrow opens the real message payload with a parse summary
- **MT ↔ MX Parser & Comparator** — parse MT103/MT202/MT202COV, convert to pacs.008/pacs.009 via BuilderService, diff MT vs MX field by field with `Automatic`/`Ambiguous`/`NoMapping` confidence per field
- **Reference & Validator** — browse the XSD tree per message, cross-search field names across 44+ shipped schemas, validate any XML against the schema with line/column-anchored errors
- **Pix QR Code** — decode and generate Copia-e-Cola (EMV-MPM) payloads, static or dynamic, with CRC-16 and DICT key detection

> Deep-dive documentation at [docs.isoleaf.dev](https://docs.isoleaf.dev) — including every ISO 20022 family (camt/pacs/pain/head), the AppHdr / Document envelope model, the 5 ecosystems' business rules, and step-by-step guides for the Builder, Flow Visualizer and MT↔MX Comparator.

---

## Architecture

Two host processes since v3.0 — the Simulator was split out so its TCP
listeners can live wherever the operator wants (typically the same
machine as their local test peers) without bundling the SPA server into
that footprint. Both hosts share a set of .NET class libraries under
`src/`.

```
isoleaf/
├── src/
│   ├── Iso8583Toolkit.IsoCore/        # ISO 8583 parsing and building
│   ├── Iso8583Toolkit.Cards/          # Card generation (PAN, tracks, CVV)
│   ├── Iso8583Toolkit.Cryptography/   # EMV cryptography (ARQC, ARPC, TLV)
│   ├── Iso8583Toolkit.Iso20022/       # ISO 20022 parsing, building, reference and validation
│   ├── Iso8583Toolkit.Application/    # Shared DTOs + application services
│   └── Iso8583Toolkit.Simulator/      # Simulator domain ports (Framing, Sessions, Logging, Protocol)
├── agent/
│   ├── Iso8583Toolkit.Backend/        # ASP.NET Core host — SPA + utility REST APIs (:8080)
│   └── Iso8583Toolkit.Agent/          # ASP.NET Core host — Simulator REST + SignalR + TCP (:8583)
├── frontend/
│   └── isohub/                        # React + TypeScript + Vite + Tailwind
└── tests/
    ├── Iso8583Toolkit.IsoCore.Tests/
    ├── Iso8583Toolkit.Cards.Tests/
    ├── Iso8583Toolkit.Iso20022.Tests/
    ├── Iso8583Toolkit.Integration.Tests/
    ├── Iso8583Toolkit.Backend.Tests/   # Backend host — utility controllers, PageRouting, E2E
    └── Iso8583Toolkit.Agent.Tests/     # Agent host — Simulator, TpduMode, Framer, Injector
```

The interactive architecture diagram at
[docs.isoleaf.dev](https://docs.isoleaf.dev) illustrates how the two
hosts talk to each other and to the browser.

---

## Running Tests

```bash
# All backend tests
dotnet test

# Frontend tests
cd frontend/isohub
npm run test
```

---

## Configuration

ISOLeaf stores configuration locally. No external services required.

### Workspace

Configure default values for:
- **Issuer Master Key (IMK)** — used for real ARQC generation in the Builder
- **Zone PIN Key (ZPK)** — used for PIN Block derivation
- **Terminal ID, Merchant ID, NIIs** — used as defaults in generated messages

### Simulator Sessions

Sessions are stored in memory and reset on restart. All TCP traffic stays local.

---

## Supported Brands

| Brand | BIN Detection | ARQC Profile | Track Generation |
|-------|--------------|--------------|-----------------|
| Visa | ✅ | CVN 10 / CVN 18 | ✅ |
| Mastercard | ✅ | M/Chip | ✅ |
| Elo | ✅ | Elo | ✅ |
| Amex | ✅ | — | ✅ |
| Hipercard | ✅ | — | ✅ |
| Generic (ISO 8583) | — | — | ✅ |

---

## Language Support

ISOLeaf supports **Portuguese (pt-BR)** and **English (en)**.
Toggle via the language button in the top-right corner.

---

## Community & Support

- 💬 **Discussions**: [github.com/isoleaf-io/isoleaf/discussions](https://github.com/isoleaf-io/isoleaf/discussions)
  — Questions, ideas and show & tell
- 🐛 **Issues**: [github.com/isoleaf-io/isoleaf/issues](https://github.com/isoleaf-io/isoleaf/issues)
  — Bug reports and feature requests
- 📧 **Email**: contato@isoleaf.dev
  — Direct contact for partnerships and enterprise inquiries
- 🔒 **Security**: [SECURITY.md](./SECURITY.md)
  — Report vulnerabilities responsibly

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on reporting bugs,
suggesting features, and submitting pull requests.

---

## License

ISOLeaf is licensed under the [Elastic License 2.0](./LICENSE).

- ✅ Free for personal and internal commercial use
- ✅ Modify and distribute for internal use
- ❌ Cannot be offered as a hosted/managed service to third parties

---

## Roadmap

- [ ] EMV tag decoders (TVR, AIP, TTQ, CVM List, IAD by brand)
- [ ] Key Block decoder (ANSI TR-31)
- [ ] ISO 20022 Simulator (Sprint 11)
- [ ] Custom MTI response map in Simulator UI
- [ ] ISO 8583:2003 layout support

---

*Built for payment engineers, by payment engineers.*
