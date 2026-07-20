import type { DocSection } from "./types";
import { TPDU_SVG, MESSAGE_STRUCTURE_SVG, EMV_BIT55_ORIGINS_SVG, EMV_DERIVATION_CHAIN_SVG, FOUR_LEGS_FLOW_SVG, ISOHUB_ARCHITECTURE_SVG, PIX_CREDIT_TRANSFER_FLOW_SVG, MT103_DIRECT_FLOW_SVG } from "./diagrams";

/** Long-form documentation in English. Mirror of content.pt.ts. */
export const DOCS_EN: Record<string, DocSection> = {
  guides: {
    id: "guides",
    blocks: [
      // ── Docker beginner-friendly guide ───────────────────────────
      { type: "heading", level: 2, text: "Self-hosting with Docker — beginner's guide" },
      {
        type: "paragraph",
        text:
          "Five steps to run the whole ISOLeaf on your machine even if you've never opened a terminal before. No `git clone`, no compiling code, no editor required. Just Docker Desktop and a one-line command.",
      },
      { type: "heading", level: 3, text: "What you need" },
      {
        type: "list",
        items: [
          "**Docker Desktop** installed — Windows, Mac or Linux. That's the only prerequisite.",
          "**A browser** — Chrome, Firefox, Safari or Edge, any recent version.",
          "**Zero extra setup** — no account, no keys, no Node/.NET/git or anything beyond Docker.",
        ],
      },

      { type: "heading", level: 3, text: "Step 1 — Install Docker Desktop" },
      {
        type: "paragraph",
        text:
          "Download the installer from the [official Docker site](https://www.docker.com/products/docker-desktop/) and run the wizard through to the end (it's the usual Next → Next → Install flow). Once installed, open **Docker Desktop** — the first launch shows a welcome/terms-of-service screen.",
      },
      {
        type: "paragraph",
        text:
          "Confirm everything is ready: at the bottom of the Docker Desktop window a green indicator should read **\"Engine running\"**. If it says \"starting\" or turns red, wait a few seconds or restart the app.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "On Windows, Docker Desktop may ask to enable WSL 2 (Windows Subsystem for Linux) on first launch — accept it. It's automatic, takes 1-2 minutes.",
      },

      { type: "heading", level: 3, text: "Step 2 — Open a terminal and paste the command" },
      {
        type: "paragraph",
        text:
          "**Where to find the terminal:** on Windows, search for \"PowerShell\" or \"Command Prompt\" in the Start menu. On Mac, open the \"Terminal\" app via Spotlight (⌘+Space, type \"terminal\"). On Linux, it is usually already on your dock as \"Terminal\" or \"Console\".",
      },
      {
        type: "paragraph",
        text:
          "Paste the command below in the terminal and press Enter. The first run downloads the image (~200 MB), wait 30s to 2 minutes depending on your connection. After that, the container starts in a few seconds:",
      },
      {
        type: "code",
        lang: "bash",
        text:
          "docker run -d --name isoleaf -p 8080:8080 ghcr.io/isoleaf-io/isoleaf:latest",
      },
      {
        type: "paragraph",
        text:
          "If a long line of letters and numbers appears (the container ID), you're good. If an error appears, see the **Common problems** section at the end of this guide.",
      },

      { type: "heading", level: 3, text: "Step 3 — Open in the browser" },
      {
        type: "paragraph",
        text:
          "Open your browser and go to **[http://localhost:8080](http://localhost:8080)**. The application shows up immediately — it is exactly the same one you use at isoleaf.dev, only running 100% locally.",
      },
      {
        type: "callout",
        tone: "success",
        text:
          "Practical difference vs. the online version: in self-hosted every TCP Simulator and EMV crypto feature is enabled — real TCP sessions, configurable IMK for ARQC/ARPC, upload of custom ISO 20022 XSDs, all without restrictions.",
      },

      { type: "heading", level: 3, text: "Step 4 (optional) — Persist XSDs across updates" },
      {
        type: "paragraph",
        text:
          "If you plan to upload custom ISO 20022 XSDs (via **Workspace → ISO 20022 Schemas**) and want them to survive `docker pull` of newer ISOLeaf versions, use a named Docker volume. Stop the current container and re-run with the `-v` flag:",
      },
      {
        type: "code",
        lang: "bash",
        text:
          "docker stop isoleaf\ndocker rm isoleaf\ndocker run -d --name isoleaf -p 8080:8080 \\\n  -v isoleaf-schemas:/app/data/schemas \\\n  ghcr.io/isoleaf-io/isoleaf:latest",
      },
      {
        type: "paragraph",
        text:
          "On first run, Docker automatically copies the 44 default XSDs into the `isoleaf-schemas` volume. Subsequent uploads land alongside them and persist across restarts and image updates. Without this flag, uploads only live for the current container's lifetime (the default catalogue is always available again).",
      },

      { type: "heading", level: 3, text: "Step 5 — Stop and update" },
      {
        type: "paragraph",
        text:
          "**Stop the container** (doesn't uninstall — just turns it off):",
      },
      {
        type: "code",
        lang: "bash",
        text:
          "docker stop isoleaf\ndocker rm isoleaf",
      },
      {
        type: "paragraph",
        text:
          "**Update to the latest version:** pull the new image, remove the old container, and re-run with the same command from Step 2 (or Step 4 if you use the volume):",
      },
      {
        type: "code",
        lang: "bash",
        text:
          "docker pull ghcr.io/isoleaf-io/isoleaf:latest\ndocker stop isoleaf && docker rm isoleaf\ndocker run -d --name isoleaf -p 8080:8080 ghcr.io/isoleaf-io/isoleaf:latest",
      },

      { type: "heading", level: 3, text: "Common problems" },
      {
        type: "callout",
        tone: "warning",
        text:
          "**Error \"port is already allocated\" or \"bind: address already in use\"** — port 8080 is already in use by another program (maybe another ISOLeaf instance, or a local server). Change the local port to 8081 (or any free one): `-p 8081:8080` in the command. Then open `http://localhost:8081` instead of 8080.",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "**Docker Desktop won't start / \"Docker daemon is not running\"** — restart Docker Desktop from the app (menu → Restart). If it persists, restart the machine and open Docker Desktop before anything else. As a last resort, reinstall Docker Desktop from the official installer.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "**How do I know the container is running?** Run `docker ps` in the terminal — if a line shows `isoleaf` and `Up X minutes`, all good. If nothing appears, run `docker ps -a` (with `-a`) to see stopped containers and review the `docker run` output for errors.",
      },

      { type: "divider" },

      // ── Portable guide (no Docker, no git) ───────────────────────
      { type: "heading", level: 2, text: "Portable — no Docker, no git" },
      {
        type: "paragraph",
        text:
          "Three steps to run ISOLeaf from a zip — no Docker, no repo clone, no editor. Distribution aimed at corporate environments where Docker is blocked but .NET is already installed on developer workstations: banks, insurers, regulated shops.",
      },

      { type: "heading", level: 3, text: "What you need" },
      {
        type: "list",
        items: [
          "**.NET 9 Runtime** — the runtime only, not the full SDK. Download from the [official Microsoft site](https://dotnet.microsoft.com/download/dotnet/9.0) and run the wizard.",
          "**A browser** — Chrome, Firefox, Safari or Edge.",
          "**No Docker**, **no git**, **no complicated command line** — the zip ships with a `run.bat` (Windows) or `run.sh` (Mac/Linux) script that boots the app.",
        ],
      },

      { type: "heading", level: 3, text: "Step 1 — Download the zip" },
      {
        type: "paragraph",
        text:
          "Open the [ISOLeaf Releases page on GitHub](https://github.com/isoleaf-io/isoleaf/releases) and download the `isoleaf-portable-vX.Y.Z.zip` file (X.Y.Z is the latest version). Extract the zip anywhere on your machine.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "The same zip runs on Windows, macOS and Linux — no per-OS build. It's a framework-dependent .NET build; the local runtime handles the platform differences automatically.",
      },

      { type: "heading", level: 3, text: "Step 2 — Run the script" },
      {
        type: "paragraph",
        text:
          "Inside the extracted folder, run the script for your OS:",
      },
      {
        type: "list",
        items: [
          "**Windows** — double-click `run.bat`, or run it from PowerShell / Command Prompt.",
          "**Mac / Linux** — open a Terminal in the folder and run `./run.sh`. If the system complains about permission, run `chmod +x run.sh` once to mark the script executable and try again.",
        ],
      },
      {
        type: "paragraph",
        text:
          "The terminal prints `Now listening on: http://localhost:8080` when it's ready. Keep the window open — closing it shuts the app down.",
      },

      { type: "heading", level: 3, text: "Step 3 — Open in the browser" },
      {
        type: "paragraph",
        text:
          "Go to **[http://localhost:8080](http://localhost:8080)**. The application appears — same screens, same features as Docker mode, including TCP Simulator, EMV cryptography and custom ISO 20022 XSD uploads.",
      },

      {
        type: "callout",
        tone: "info",
        text:
          "**Changing port 8080** — if something else already uses that port on your machine, there are two ways to change it. **Option A:** edit `appsettings.json` inside the extracted folder, section `\"Agent\": { \"Port\": 9090 }`, and re-run the script. **Option B:** set the `ASPNETCORE_URLS=http://localhost:9090` environment variable before running (`set ASPNETCORE_URLS=…` on Windows CMD, `export ASPNETCORE_URLS=…` on Mac/Linux). Then open `http://localhost:9090`.",
      },
      {
        type: "callout",
        tone: "success",
        text:
          "**Typical use case:** a developer at a bank/insurer where IT policy blocks Docker and other containers, but the .NET Runtime is already installed on workstations (common in corporate .NET stacks). The Portable zip runs straight — no admin rights, no VPN, no infrastructure-team ticket.",
      },

      { type: "divider" },

      { type: "heading", level: 2, text: "ISOLeaf architecture" },
      {
        type: "paragraph",
        text:
          "ISOLeaf is a standalone application that runs entirely on your machine. No data leaves your environment.",
      },
      { type: "svg", text: ISOHUB_ARCHITECTURE_SVG },
      { type: "heading", level: 3, text: "Security" },
      { type: "callout", tone: "success", text: "Data stays on your machine — zero telemetry, no external connections beyond what you configure." },
      { type: "callout", tone: "warning", text: "No JWT authentication — open access on localhost. If you expose port 8080 to the network (0.0.0.0), any machine on the network can access it without a password. Use only on trusted networks or behind a firewall." },
      { type: "heading", level: 3, text: "Data stored locally" },
      {
        type: "list",
        items: [
          "Workspace (IMK, ZPK, settings): local JSON file",
          "Templates: browser localStorage",
          "EMV history: session memory (cleared on restart)",
        ],
      },

      // ── First steps — module overview ─────────────────────────────
      { type: "heading", level: 2, text: "First steps — meeting the modules" },
      {
        type: "paragraph",
        text:
          "ISOLeaf is organized in six modules. Before diving into a specific guide, it's worth quickly getting to know what each one does.",
      },

      { type: "heading", level: 3, text: "Parser" },
      {
        type: "paragraph",
        text:
          "The most-used module. Paste any ISO 8583 message (ASCII wire or binary-hex, with or without TPDU) and see every field decoded automatically. Click any field to copy it, reveal masked values, or jump to other modules.",
      },
      {
        type: "image",
        src: "/screenshots/parse1.png",
        alt: "Parser screen",
        caption: "Parser — decodes any ISO 8583 message",
      },

      { type: "heading", level: 3, text: "Builder" },
      {
        type: "paragraph",
        text:
          "Builds complete ISO 8583 messages without having to know every field. Pick the context (role, brand, channel, transaction type) and ISOLeaf fills in the correct fields — including Bit 55 with a real ARQC when the IMK is configured in Workspace.",
      },
      {
        type: "image",
        src: "/screenshots/builder2.png",
        alt: "Builder with generated message",
        caption: "Builder — generated message with auto-populated fields",
      },
      {
        type: "image",
        src: "/screenshots/builder3.png",
        alt: "Add-extra-bits panel in the Builder",
        caption: "Builder — add extra bits to a generated message",
      },

      { type: "heading", level: 3, text: "Simulator" },
      {
        type: "paragraph",
        text:
          "Spin up a Responder (Rebatedor) to receive TCP messages and reply automatically — simulating an authorizer/issuer. Or use the Injector to send messages to your system and watch the responses live.",
      },
      {
        type: "image",
        src: "/screenshots/simulator.png",
        alt: "Simulator screen",
        caption: "Simulator — 4 active sessions with a successfully bounced message",
      },

      { type: "heading", level: 3, text: "EMV Data" },
      {
        type: "paragraph",
        text:
          "Six tabs for working with EMV cryptography: Parse Bit 55, Validate ARQC, Generate ARQC, Generate ARPC, Build Response and Full Flow.",
      },
      {
        type: "image",
        src: "/screenshots/emv1.png",
        alt: "EMV Data screen",
        caption: "EMV Data — Parse Bit 55 with decoded tags",
      },

      { type: "heading", level: 3, text: "Test Card" },
      {
        type: "paragraph",
        text:
          "Generates valid PANs with tracks and CVV per brand for testing without needing real cards.",
      },
      {
        type: "image",
        src: "/screenshots/testcard.png",
        alt: "Test Card screen",
        caption: "Test Card — generates valid data per brand",
      },

      { type: "heading", level: 3, text: "Workspace" },
      {
        type: "paragraph",
        text:
          "Configure default values (Terminal ID, Merchant ID, NIIs) and cryptographic keys (IMK, ZPK) that are used automatically by the Builder and Simulator.",
      },
      {
        type: "image",
        src: "/screenshots/workspace.png",
        alt: "Workspace screen",
        caption: "Workspace — settings and cryptographic keys",
      },
      {
        type: "image",
        src: "/screenshots/workspace2.png",
        alt: "Saved templates in Workspace",
        caption: "Workspace — saved templates for reuse in the Builder",
      },

      { type: "divider" },

      // ── ISO 20022 tour ────────────────────────────────────────────
      { type: "heading", level: 2, text: "Getting started — ISO 20022 modules" },
      {
        type: "paragraph",
        text:
          "ISOLeaf's ISO 20022 block bundles eight modules that cover the full cycle of reading, producing and visualising messages. This section introduces each one in a single line so you know where to go; the deep step-by-step walkthroughs for the most common cases follow in the \"Practical guides — ISO 20022\" block below.",
      },

      { type: "heading", level: 3, text: "XML Parser" },
      {
        type: "paragraph",
        text:
          "Paste any ISO 20022 XML (with or without AppHdr) and see the field tree decoded. The parser detects family and version by namespace, applies the right XSD automatically and produces a semantic summary (operation type, actors, amount, Pix key when present). A \"Generate Return\" button produces the correlated response message (pacs.008 → pacs.002/pacs.004).",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/parser-xml.png",
        alt: "ISO 20022 XML Parser screen",
        caption: "XML Parser — decoded field tree + semantic summary",
      },

      { type: "heading", level: 3, text: "Field Reference" },
      {
        type: "paragraph",
        text:
          "Browsable tree of the structure of every supported message. The \"By message\" tab shows the entire XSD as a tree; the \"Field search\" tab cross-checks a name (e.g. EndToEndId, Dbtr, RmtInf) against every version and family — useful for seeing where a field appears in different types and how its cardinality evolved across versions.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/referencia-campos.png",
        alt: "ISO 20022 Field Reference screen",
        caption: "Field Reference — per-message tree + cross-family search",
      },

      { type: "heading", level: 3, text: "XSD Validator + Version Comparator" },
      {
        type: "paragraph",
        text:
          "The Validator (button inside the Parser) runs the XML against the XSD and returns errors with short English messages — the verbose .NET parser text is reworded per error family (invalid element, value outside facet, cardinality mismatch, wrong namespace). The Version Comparator diffs two versions of the same type (e.g. pacs.008.001.09 vs pacs.008.001.13) listing added, removed and altered fields; when opened from a specific message, it filters the diff by the fields your message uses.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/validador-comparador.png",
        alt: "XSD Validator and Version Comparator screens",
        caption: "Validator + Comparator — translated schema errors and cross-version diff",
      },

      { type: "heading", level: 3, text: "Builder" },
      {
        type: "paragraph",
        text:
          "Composes complete ISO 20022 messages from an Ecosystem → Scenario → Version cascade. Supports 5 ecosystems: **Brazilian Pix** (SPI/BCB with regulated EndToEndId, ISPB and TxId formats), **SEPA** (euro-area credit and status), **SWIFT CBPR+** (cover payments, returns, cancellations, status inquiry), **TARGET/T2** (Eurosystem RTGS) and **Generic** (to explore any loaded XSD). The Form/XML split lets you watch the message being written in real time; below the md breakpoint the UI switches to tabs to fit on mobile.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/builder.png",
        alt: "ISO 20022 Builder screen with form and XML side by side",
        caption: "Builder — Ecosystem → Scenario → Version cascade with Form/XML split",
      },

      { type: "heading", level: 3, text: "Pix QR Code" },
      {
        type: "paragraph",
        text:
          "Decodes and generates EMV payloads for Pix Copia e Cola (BR Code). Handles static QR (key + amount) and dynamic QR (POI with TXID). Serves both for inspecting a third-party QR and for producing test QRs — with inline validation of the BR Code standard's mandatory fields.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/qrcode-pix.png",
        alt: "Pix QR Code module screen",
        caption: "Pix QR Code — decoding and generation of BR Code (Pix Copia e Cola)",
      },

      { type: "heading", level: 3, text: "Flow Visualizer" },
      {
        type: "paragraph",
        text:
          "Multi-message sequence diagram. Four protocol tabs (Brazilian Pix, SWIFT CBPR+ MX, SWIFT CBPR+ MT, ISO 8583) — each with its own set of prebuilt flows (direct credit, cover payment, return, cancellation, transfer with stand-in, etc.). Clicking an arrow opens the matching payload in a row below, with parse output + \"open in Parser\" button when the step is XML.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/flow-visualizer.png",
        alt: "Flow Visualizer screen with sequence diagram",
        caption: "Flow Visualizer — multi-message sequence per protocol",
      },

      { type: "heading", level: 3, text: "MT Parser" },
      {
        type: "paragraph",
        text:
          "Parses SWIFT MT messages (legacy format, {1:...}{2:...}{3:...}{4:...} blocks). Recognises MT103 (customer credit), MT202 and MT202COV (interbank and cover). Complements the MT↔MX Comparator when the integration must support both formats during CBPR+ migration.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/parser-mt.png",
        alt: "MT Parser screen with decoded SWIFT message",
        caption: "MT Parser — decodes MT103/MT202/MT202COV block by block",
      },

      { type: "heading", level: 3, text: "MT↔MX Comparator" },
      {
        type: "paragraph",
        text:
          "Diffs an MT message against its equivalent MX (e.g. MT103 vs pacs.008). Mode A generates the MX from the MT via the Builder and shows the two side by side; Mode B compares two existing messages field by field. Each diff row carries a confidence level (Automatic when the CBPR+ mapping is direct, Ambiguous when there is more than one equivalent option, NoMapping when the field has no counterpart in the other format).",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/comparador-mt-mx.png",
        alt: "MT↔MX Comparator screen with MT103/pacs.008 diff",
        caption: "MT↔MX Comparator — field-by-field diff with confidence levels",
      },

      { type: "heading", level: 3, text: "Workspace" },
      {
        type: "paragraph",
        text:
          "Workspace consolidates ISOLeaf's persistent configuration. It exposes three tabs:",
      },
      {
        type: "list",
        items: [
          "**Configuration** — default values applied to the Builder and the Simulator: institution identity, ISPB, BIC, test accounts, cryptographic keys (IMK, ZPK) for the ISO 8583 side. Configured once, applied everywhere.",
          "**Templates** — saved, reusable messages. Each template stores context + populated fields; a single click brings the Builder back to that exact state. Supports JSON import/export to move between machines.",
          "**ISO 20022 Schemas** — inventory of the XSDs the Agent knows about, grouped by family (camt/head/pacs/pain). An upload button adds a new XSD; the schema is validated, written to disk and the registry is reloaded in place — no restart. Sprint 10.1 introduced hybrid persistence via a Docker volume: the `schemas-data` volume (mounted at `/app/data/Schemas`) preserves uploaded XSDs across container restarts, while the base catalogue remains embedded in the image.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "After an XSD upload, the Reference, Comparator and Builder see the new version immediately — SchemaUploadService cascades the reload into ReferenceService.",
      },

      { type: "divider" },

      // ── Practical guides ──────────────────────────────────────────
      { type: "heading", level: 2, text: "Practical guides" },
      {
        type: "paragraph",
        text:
          "Step-by-step walkthroughs of the most common ISOLeaf flows. Each guide starts from a concrete scenario and shows the exact clicks.",
      },

      {
        type: "heading",
        level: 3,
        text: "Parse an ISO 8583 message",
        subtitle: "Scenario: you received an ISO 8583 message and need to understand what it contains.",
      },
      {
        type: "image",
        src: "/screenshots/parse1.png",
        alt: "Parser screen showing a decoded ISO 8583 message",
        caption: "Parser — paste a message and see every field decoded",
      },
      {
        type: "image",
        src: "/screenshots/parse2.png",
        alt: "Parser with a parsed message",
        caption: "Parser — decoded message with every field",
      },
      {
        type: "image",
        src: "/screenshots/parse3.png",
        alt: "Parser displaying the bitmap",
        caption: "Parser — visualization of the active bits in the bitmap",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open the **Parser** module.",
          "Paste the message in the text field (accepts ASCII wire, binary-hex or with TPDU).",
          "Click **Parse →** or press `Ctrl+Enter`. ISOLeaf auto-detects the format.",
        ],
      },
      { type: "callout", tone: "info", text: "Pasting a message triggers parse automatically (300 ms debounce)." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Build an ISO 8583 message",
        subtitle: "Scenario: you need a ready-made message to test an integration.",
      },
      {
        type: "image",
        src: "/screenshots/builder2.png",
        alt: "Builder with generated message and populated fields",
        caption: "Builder — pick the context and generate the full message",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open the **Builder** module.",
          "Select **MTI**, **Role**, **Brand**, **Channel** and **Transaction type**.",
          "Click **Build →**. Fields are populated automatically.",
          "Edit values as needed in the table.",
          "Copy the generated message (ASCII wire or binary-hex).",
        ],
      },
      { type: "callout", tone: "info", text: "Configure the IMK in the **Workspace** to generate a real **ARQC** instead of a random one." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Validate a transaction's ARQC",
        subtitle: "Scenario: you received a message with Bit 55 and want to confirm the cryptogram is legitimate.",
      },
      {
        type: "image",
        src: "/screenshots/emv2.png",
        alt: "ARQC validation screen in the EMV Data module",
        caption: "EMV Data — ARQC validation with detailed result",
      },
      { type: "paragraph", text: "Prerequisite: have the Bit 55 in hex and the issuer's IMK." },
      {
        type: "list",
        ordered: true,
        items: [
          "Open **EMV Data** → **Validate ARQC** tab.",
          "Paste the Bit 55 in hex.",
          "Provide the Issuer Master Key (**IMK-AC**).",
          "Provide the **PAN** and **PAN Sequence Number** (usually `00`).",
          "Select the brand profile.",
          "Click **Validate ARQC**.",
        ],
      },
      { type: "callout", tone: "info", text: "Use **Validate in EMV** directly from the **Parser** — the PAN and brand are auto-filled after parsing a message with Bit 55." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Simulate an authorizer (Rebatedor)",
        subtitle: "Scenario: you have a terminal/system that sends transactions and want to simulate the authorizer.",
      },
      {
        type: "image",
        src: "/screenshots/simulator.png",
        alt: "Simulator screen with 4 active responder sessions",
        caption: "Simulator — 4 active sessions with a successfully bounced message",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open **Simulator** and click **+ New session**.",
          "Configure: **TCP port** (e.g. `9100`), **Role** = `Issuer`, **Default RC** = `00`, **Auto respond** on.",
          "Click **Confirm**.",
          "Point your terminal to `localhost:9100`.",
          "ISOLeaf responds automatically to each received message.",
        ],
      },
      { type: "callout", tone: "info", text: "Click the log icon on the session card to filter the log to just that session." },

      { type: "heading", level: 4, text: "Responder (Listener)" },
      {
        type: "paragraph",
        text:
          "Opens a local TCP port and waits for connections. When it receives a message, it replies automatically according to the session's settings.",
      },
      { type: "paragraph", text: "Configuration fields:" },
      {
        type: "list",
        items: [
          "**TCP port**: local port to listen on (e.g. `9100`).",
          "**Role**: defines the context of the automatic response — `Acquirer` (simulates a credenciadora), `Brand` (simulates the network) or `Issuer` (simulates the issuing bank, most common).",
          "**Default RC**: default response code (`00` = approve everything).",
          "**TPDU mode**: how to handle the TPDU prefix — `Optional` (accepts with or without), `Required` (rejects without TPDU) or `Strip` (removes before processing).",
          "**Unknown MTI**: how to reply to unmapped MTIs — `Derive` (auto-derives `0100`→`0110`), `Reject` (no response), `Echo` (replies with the same MTI), or `Custom` (a specific MTI).",
          "**Auto respond**: toggle on/off.",
          "**Validate ARQC**: checks the EMV cryptogram (requires an IMK configured in the **Workspace**).",
        ],
      },
      {
        type: "image",
        src: "/screenshots/new_session.png",
        alt: "Simulator new-session form",
        caption: "Session creation — Responder configuration including the framing mode (Length prefix)",
      },

      { type: "heading", level: 4, text: "Configure EMV response (Issuer Listener)" },
      {
        type: "paragraph",
        text:
          "In Issuer mode, the Responder can be configured to define how Bit 55 is handled in the response. Click the ⚙️ button on the session card to access the options.",
      },
      {
        type: "image",
        src: "/screenshots/simulator2.png",
        alt: "EMV response configuration on the Issuer Responder",
        caption: "EMV Config — pick between Echo (copy Bit 55) or Generate ARPC (simulate a real issuer)",
      },
      {
        type: "list",
        items: [
          "**Echo** (default): copies the received Bit 55 directly into the response. Works with any format, including messages with a proprietary header before the TLV.",
          "**Generate ARPC**: derives the ARPC using the IMK and returns the response Bit 55 with tags `91` and `8A`. Lets you configure the proprietary header size (if any) and the IMK (uses the Workspace if blank).",
          "**Validate ARQC**: when enabled together with **Generate ARPC**, validates the ARQC before generating the response. An invalid ARQC results in RC=05 in the response.",
        ],
      },

      { type: "heading", level: 4, text: "Injector (Connector)" },
      {
        type: "paragraph",
        text:
          "Connects to an external TCP system and sends messages. Use it to test your authorizer by sending transactions and checking the responses.",
      },
      { type: "paragraph", text: "Configuration fields:" },
      {
        type: "list",
        items: [
          "**Target host**: IP or hostname of the target system.",
          "**Target port**: TCP port of the target system (e.g. `8583`).",
          "**Message**: the ISO 8583 to send (hex or ASCII wire).",
          "**Continuous mode**: sends in a loop (1 msg/s). Tick **Vary identifiers** so STAN/RRN/DateTime change on each send; **Vary amount** for a random Amount within a range.",
        ],
      },

      { type: "heading", level: 4, text: "Live log" },
      {
        type: "paragraph",
        text:
          "Shows in real time every message received and sent by the Responders. Click the log icon on each session to filter the log to that session only.",
      },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Inject messages (Injector)",
        subtitle: "Scenario: you have an authorizer running and want to send transactions to test it.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open **Simulator** → **Injector** section.",
          "Configure **Target host** and **Target port** (e.g. `localhost:8583`).",
          "Paste the ISO 8583 message in the text area (can be one generated by the **Builder**).",
          "Click **Inject →** to send a single message or **Start continuous** for a 1 msg/s loop.",
        ],
      },
      { type: "callout", tone: "info", text: "Tick **Vary identifiers** so each send carries a different STAN/RRN — prevents rejection as duplicate." },

      { type: "divider" },

      { type: "heading", level: 2, text: "The six tabs of the EMV Data module" },
      {
        type: "paragraph",
        text:
          "The **EMV Data** module organizes the cryptography flows into six chainable tabs. You can use each one in isolation or combine them in **Full Flow**.",
      },

      { type: "heading", level: 4, text: "Parse Bit 55" },
      {
        type: "paragraph",
        text:
          "Paste a Bit 55 in hex and see every BER-TLV tag decoded. Supports partial parse — if it hits an invalid tag, it shows what it managed to parse up to that point.",
      },
      {
        type: "image",
        src: "/screenshots/emv1.png",
        alt: "Parse Bit 55 — empty state",
        caption: "Parse Bit 55 — paste the Bit 55 in hex to decode the tags",
      },

      { type: "heading", level: 4, text: "Validate ARQC" },
      {
        type: "paragraph",
        text:
          "Check whether a received ARQC is legitimate. Provide the Bit 55, the IMK and the PAN. ISOLeaf recomputes the derivation chain and compares against the received ARQC.",
      },
      {
        type: "image",
        src: "/screenshots/emv3.png",
        alt: "Validate ARQC — validation screen",
        caption: "Validate ARQC — provide Bit 55, IMK and PAN to validate",
      },

      { type: "heading", level: 4, text: "Generate ARQC" },
      {
        type: "paragraph",
        text:
          "Produce a real ARQC from transaction data. Useful for creating realistic test data or verifying your derivation implementation.",
      },
      {
        type: "image",
        src: "/screenshots/emv4.png",
        alt: "Generate ARQC — generation screen",
        caption: "Generate ARQC — build a real ARQC from transaction data",
      },

      { type: "heading", level: 4, text: "Generate ARPC" },
      {
        type: "paragraph",
        text:
          "Produce the ARPC (issuer response) from a received ARQC. Supports **Method 1** (Visa/Elo) and **Method 2** (Mastercard).",
      },
      {
        type: "image",
        src: "/screenshots/emv5.png",
        alt: "Generate ARPC — response generation screen",
        caption: "Generate ARPC — build the issuer response (Method 1 or 2)",
      },

      { type: "heading", level: 4, text: "Build Response" },
      {
        type: "paragraph",
        text:
          "Assemble the response Bit 55 (tags `91` + `8A`) the issuer should return in the response message.",
      },
      {
        type: "image",
        src: "/screenshots/emv6.png",
        alt: "Build Response — assemble Bit 55 of the response",
        caption: "Build Response — assemble the response Bit 55 with ARPC and ARC",
      },

      { type: "heading", level: 4, text: "Full Flow" },
      {
        type: "paragraph",
        text:
          "Runs the four steps in automatic sequence — **Parse Bit 55** → **Validate ARQC** → **Generate ARPC** → **Build Response**. The full issuer flow in one click.",
      },
      {
        type: "image",
        src: "/screenshots/emv7.png",
        alt: "Full Flow EMV with complete result",
        caption: "Full Flow — ARQC validated, ARPC generated, Bit 55 assembled",
      },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Full Flow EMV",
        subtitle: "Scenario: receive a chip transaction and respond correctly with an ARPC.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open **EMV Data** → **Full Flow** tab.",
          "Fill in: **Bit 55** hex of the received message, **IMK-AC**, **PAN**, **PAN Sequence Number**, **Auth Response Code**.",
          "Click **Run Full EMV Flow**.",
          "ISOLeaf parses Bit 55, validates the ARQC, generates the ARPC and assembles the response Bit 55 (tags `91` + `8A`).",
          "Copy the response Bit 55 to include in your `0110` / `0210`.",
        ],
      },

      { type: "divider" },

      // ── Practical guides — ISO 20022 ─────────────────────────────
      { type: "heading", level: 2, text: "Practical guides — ISO 20022" },
      {
        type: "paragraph",
        text:
          "Three flows cover 90% of what analysts do day to day with ISOLeaf's ISO 20022 block: composing a multi-ecosystem message in the Builder, reading a sequence diagram in the Flow Visualizer and interpreting the MT↔MX Comparator's report. Each guide starts from scratch and assumes you just opened the module.",
      },

      // ── Guide: Multi-ecosystem Builder ───────────────────────────
      {
        type: "heading",
        level: 4,
        text: "Multi-ecosystem Builder",
        subtitle: "Scenario: you need to generate a ready-to-test ISO 20022 message — without writing XML by hand.",
      },
      {
        type: "paragraph",
        text:
          "The Builder works as an Ecosystem → Scenario → Version → Generate cascade. Each ecosystem brings its own set of scenarios (with realistic placeholders for names, accounts, BICs) and requires only the fields the target network actually needs — this avoids the explosion of optional fields the raw ISO 20022 XSD carries by default.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open the **Builder** module.",
          "Pick an **Ecosystem**. Options are: **Brazilian Pix** (SPI/BCB rules), **SEPA** (euro area), **SWIFT CBPR+** (cross-border with BIC), **TARGET/T2** (Eurosystem RTGS) and **Generic** (lets you pick any loaded XSD, no local business rules).",
          "Pick a **Scenario**. The scenario determines the message type (pacs.008, pain.001, pacs.004, camt.056, etc.) and brings a set of per-ecosystem defaults — Debtor, Creditor, intermediary agents, purpose codes.",
          "Pick a **Version**. Only versions supported by the scenario appear — for pacs.008 in Pix, for instance, the Builder ships `001.13` as default (the current SPI version). If you need an older version to test backward compatibility, choose it from the list.",
          "Click **↺ Test data** to auto-populate Debtor/Creditor with names and accounts from a per-ecosystem fake data generator (locale pt_BR for Pix, de/en for SEPA/CBPR+/T2).",
          "Click **Generate**. The Builder calls the backend, assembles the Document and renders the XML in real time next to the form.",
          "Edit any field directly in the form — the XML on the right reacts. Regulated fields (32-char EndToEndId in Pix, UUID v4 UETR in CBPR+) have a **⟳** button to regenerate the value in the official format.",
          "Use the search bar at the top of the form to promote an optional field. The Builder automatically includes ancestors (adding `PmtId/InstrId` opens `PmtId`, gaining the `InstrId` inside).",
          "**Copy XML** to paste into your integrator or **Open in Parser** to inspect the result immediately with validation.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Difference between the 5 ecosystems. Brazilian Pix enforces BCB's Standards Manual (regulated EndToEndId formats, ISPB instead of BIC). SEPA works with IBAN and euro-area purpose codes. SWIFT CBPR+ requires BIC + UETR and adds cover payments (pacs.009). TARGET/T2 is the European high-value RTGS variant. Generic serves to explore any XSD (including custom schemas uploaded in Workspace) without extra rules — useful for pure structural conformance tests.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "How to read the generated XML. The top of the Document defines the namespace (identifies type + version). GrpHdr carries batch metadata (MsgId, CreDtTm, NbOfTxs, SttlmInf). The message-specific body (FIToFICstmrCdtTrf in pacs.008, CstmrCdtTrfInitn in pain.001) contains one or more transactions — each transaction has its PmtId (identifiers), the Debtor/Creditor pair with their agents, and the RmtInf with remittance information.",
      },

      { type: "divider" },

      // ── Guide: Flow Visualizer ───────────────────────────────────
      {
        type: "heading",
        level: 4,
        text: "Flow Visualizer",
        subtitle: "Scenario: you need to understand how a sequence of messages flows between the participants of a protocol.",
      },
      {
        type: "paragraph",
        text:
          "The Flow Visualizer draws classic sequence diagrams: columns for each actor, vertical arrows for each message, a timeline going down. It is useful both for learning a new protocol and for debugging a real integration — each arrow opens the matching payload and you can see the XML actually flowing over each hop.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open **Flow Visualizer**. The top of the screen has four protocol tabs: **🇧🇷 Pix** (BR), **⚡ CBPR+ MX** (SWIFT XML), **📄 CBPR+ MT** (legacy SWIFT) and **💳 ISO 8583** (card world).",
          "Pick the tab of the protocol you want to study. Each tab has its own flow catalogue and its own actor lane — in Pix it's \"Payer → Payer PSP → SPI/BCB → Payee PSP → Payee\"; in CBPR+ MX it's \"Originator Bank → SWIFT/Correspondent → Intermediary Bank → Beneficiary Bank\".",
          "Pick a **Flow** in the top dropdown. Examples per tab: in Pix — Transfer, Transfer with return, Open Finance, Rejected, Pix Automático; in CBPR+ — Direct Payment, Cover Payment, Return, Cancellation, Status Inquiry.",
          "Click **Generate Flow**. ISOLeaf produces valid fictional messages for each step of the chosen flow and draws the diagram.",
          "Read the diagram. Each arrow is a step; the label above the arrow identifies the message (e.g. `pacs.008.001.13`). Solid arrows are main hops; **dashed arrows** represent BCB/correspondent relays; **red arrows** represent timeouts (issuer went silent, stand-in).",
          "Click on an arrow. A second row appears below, showing the step's **XML payload** + a **parse summary** next to it. If the step is MT (legacy) or ISO 8583, the adaptive panel switches to the right format.",
          "Use **Open in Parser** inside the step panel to dig deeper — the Parser opens with the XML pre-filled and ready for validation.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Actors and arrows — quick reading. Each vertical column is an actor (PSP, bank, SPI, network). An arrow from column A to column B represents a message flowing from A to B. The descending order of arrows is the timeline of the flow. A \"clickable\" step is any arrow — it always maps to a real generated payload (not empty illustration).",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "The diagram is auto-scaled to fit the available width — on mobile it shrinks without requiring horizontal dragging. If the label text becomes too small, rotate the device or open on a larger screen for comfortable reading.",
      },

      { type: "divider" },

      // ── Guide: MT↔MX Comparator ─────────────────────────────────
      {
        type: "heading",
        level: 4,
        text: "MT↔MX Comparator",
        subtitle: "Scenario: your integration must support both SWIFT MT and ISO 20022 (MX) in parallel during the CBPR+ migration.",
      },
      {
        type: "paragraph",
        text:
          "The MT↔MX Comparator confronts an SWIFT MT (legacy) message with its ISO 20022 (MX) counterpart. Three questions to answer: (a) do those two XMLs represent the same operation? (b) which fields were automatically translated and which required heuristics? (c) what to do with those that have no counterpart on the other side?",
      },
      { type: "heading", level: 3, text: "Mode A — Generate MX from MT via Builder" },
      {
        type: "paragraph",
        text:
          "In Mode A you paste only the MT (e.g. an MT103) and ISOLeaf generates the equivalent MX automatically, reusing the BuilderService. Use this mode when you have the original MTs and want to see the expected MX result of the migration.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open **MT↔MX Comparator**.",
          "Select the **Mode A — Generate MX from MT** tab.",
          "Paste the **MT** in the textarea (classic SWIFT format with `{1:...}{2:...}{3:...}{4:...}` blocks).",
          "Pick the **destination MX family** (pacs.008 for MT103, pacs.009 for MT202/MT202COV).",
          "Click **Generate & compare**. ISOLeaf parses the MT, calls the Builder with the appropriate CBPR+ scenario and produces the MX; the result panel shows both side by side with the field-by-field diff.",
        ],
      },
      { type: "heading", level: 3, text: "Mode B — Compare two existing messages" },
      {
        type: "paragraph",
        text:
          "In Mode B you already have the MT/MX pair and want to confirm equivalence or point out divergences. This is the typical reconciliation mode: an integration that already produces MX must be validated against historical MTs.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Select the **Mode B — Compare two payloads** tab.",
          "Paste the **MT** on the left textarea and the **MX** on the right.",
          "Click **Compare**. ISOLeaf matches fields via the CBPR+ mapping table and produces the diff.",
        ],
      },
      { type: "heading", level: 3, text: "How to resolve ambiguous fields" },
      {
        type: "paragraph",
        text:
          "When the Comparator finds a field at **Ambiguous** confidence, it highlights the row in yellow and lists candidates. Ambiguity happens because the same information can appear in different positions in the MX depending on the scenario variation — for instance, a beneficiary address in the MT can map to `Cdtr/PstlAdr/AdrLine` or `Cdtr/PstlAdr/StrtNm+PstCd+TwnNm` in the MX, depending on whether CBPR+ requires structured address (post-2025) or accepts free-form lines (pre-2025).",
      },
      {
        type: "list",
        items: [
          "Click the ambiguous row to expand the candidates.",
          "Compare the MT value with each candidate — usually one matches exactly the text you'd expect to see.",
          "Pick the candidate by clicking the **Accept mapping** chip. ISOLeaf remembers the decision locally for the next comparisons of the session (not persisted across reloads — the goal is to speed up batches).",
          "If no candidate matches, the problem is usually upstream of the Comparator: the Builder may have written the field to an unexpected position, or the original MT is off-standard. Go back one step (Builder or MT Parser) to investigate.",
        ],
      },
      { type: "heading", level: 3, text: "Confidence levels" },
      {
        type: "table",
        headers: ["Level", "Colour", "Meaning", "Typical action"],
        rows: [
          ["Automatic", "Green", "Direct CBPR+ mapping, no ambiguity. ISOLeaf matched the MT field to a single MX destination based on the official table.", "None — the diff is reliable."],
          ["Ambiguous", "Yellow", "More than one destination candidate exists in the MX. ISOLeaf lists options without picking automatically.", "Expand, compare values and accept the correct candidate."],
          ["NoMapping", "Grey", "The field exists in one format and has no equivalent in the other. Common on new ISO 20022 fields (UETR, structured address, ISO purpose codes) and legacy MT fields (Sender's Reference, Related Reference).", "Log as \"controlled loss\" in the migration — not everything from MT must reach MX or vice-versa."],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Rule of thumb: if the sum of \"Ambiguous\" + \"NoMapping\" is small and concentrated on predictable fields (structured vs free-form address, sender reference), the migration is healthy. If critical financial fields (amount, currency, accounts, BICs) show up as \"NoMapping\", investigate — likely the parser missed the field on the MT because of a formatting deviation.",
      },

      { type: "divider" },

      { type: "heading", level: 2, text: "Community & Support" },
      {
        type: "list",
        items: [
          "💬 [GitHub Discussions](https://github.com/isoleaf-io/isoleaf/discussions) — questions, ideas and feedback",
          "🐛 [GitHub Issues](https://github.com/isoleaf-io/isoleaf/issues) — bug reports and feature requests",
          "📧 Email: **contato@isoleaf.dev** — for partnerships and enterprise inquiries",
        ],
      },
    ],
  },

  iso8583: {
    id: "iso8583",
    blocks: [
      // ── 1. What is ISO 8583 ───────────────────────────────────────────
      { type: "heading", level: 2, text: "What is ISO 8583" },
      {
        type: "paragraph",
        text:
          "ISO/IEC 8583 is the international standard that defines the structure, fields and encoding of electronic messages exchanged in card payment transactions — authorizations, financial, reversals, network management and administrative.",
      },
      {
        type: "paragraph",
        text:
          "It is the common language between terminals/POS, acquirers, brand networks and issuers: every participant sends and receives messages in this format, on both directions of the flow (request and response).",
      },
      {
        type: "paragraph",
        text:
          "The standard does NOT define the transport protocol (TCP, X.25, SNA, etc.) — only the message format itself. Each network decides how to frame and transport these messages; this is why concepts like TPDU, length-based framing or STX/ETX are defined per brand/network, not by ISO 8583.",
      },

      // ── 2. Structure ──────────────────────────────────────────────────
      { type: "heading", level: 2, text: "Message structure" },
      {
        type: "paragraph",
        text:
          "A full message can have up to 3 parts: TPDU (optional, transport) + MTI + Bitmap(s) + Data Elements. The TPDU is widely used in TCP/IP networks but is not part of the ISO 8583 standard itself.",
      },
      { type: "svg", text: MESSAGE_STRUCTURE_SVG },

      // ── 3. TPDU ───────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "TPDU — Transport Protocol Data Unit" },
      {
        type: "callout",
        tone: "info",
        text:
          "The TPDU is not part of the ISO 8583 standard. It's a routing header added by each network's transport protocol (Visa, Mastercard, acquirer networks). Not every implementation uses TPDU.",
      },
      {
        type: "paragraph",
        text:
          "When present, it's 5 bytes (10 hex chars) prefixed to the ISO 8583 message. Used for TCP routing between participants — it tells the concentrator who sent the message and who should receive it.",
      },
      {
        type: "table",
        headers: ["Bytes", "Field", "Size", "Example"],
        rows: [
          ["Byte 1", "Protocol ID", "1 byte", "60"],
          ["Bytes 2-3", "Origin NII", "2 bytes", "0002"],
          ["Bytes 4-5", "Destination NII", "2 bytes", "0001"],
        ],
      },
      { type: "svg", text: TPDU_SVG },
      {
        type: "paragraph",
        text:
          "NII (Network Interface Identifier) is an identifier assigned by the brand to each network participant. Full example: 6000020001 → protocol 0x60, origin 0002, destination 0001.",
      },

      // ── 4. MTI ────────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "MTI — Message Type Indicator" },
      {
        type: "paragraph",
        text:
          "4 numeric digits identifying the message type. Each digit has a specific positional meaning — read left to right.",
      },
      {
        type: "table",
        headers: ["Digit", "Name", "Values"],
        rows: [
          ["1", "Version", "0 = ISO 8583:1987 · 1 = ISO 8583:1993 · 2 = ISO 8583:2003"],
          ["2", "Class", "1 = Authorization · 2 = Financial · 4 = Reversal · 8 = Network"],
          ["3", "Function", "0 = Request · 1 = Response · 2 = Advice · 3 = Advice response"],
          ["4", "Origin", "0 = Acquirer · 2 = Issuer · 4 = Other"],
        ],
      },
      { type: "heading", level: 3, text: "Most common MTIs" },
      {
        type: "table",
        headers: ["MTI", "Name", "Typical use"],
        rows: [
          ["0100", "Authorization Request", "Pre-authorization (no debit)"],
          ["0110", "Authorization Response", "Reply to pre-authorization"],
          ["0200", "Financial Request", "Immediate debit (purchase, withdrawal)"],
          ["0210", "Financial Response", "Reply to financial transaction"],
          ["0400", "Reversal Request", "Reversal / void of a transaction"],
          ["0410", "Reversal Response", "Reversal confirmation"],
          ["0420", "Reversal Advice", "Reversal advice (no response expected)"],
          ["0800", "Network Management Request", "Echo test, sign-on / sign-off"],
          ["0810", "Network Management Response", "Reply to network management"],
        ],
      },

      // ── 5. Bitmap ─────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "Bitmap — map of present fields" },
      {
        type: "paragraph",
        text:
          "The bitmap is a sequence of bits where each bit indicates whether the corresponding field is present in the message. Bit 1 = present; bit 0 = absent.",
      },
      {
        type: "list",
        items: [
          "Primary bitmap: 8 bytes (64 bits) → indicates fields 1 to 64.",
          "Secondary bitmap: 8 bytes (64 bits) → indicates fields 65 to 128.",
          "The secondary bitmap only appears when bit 1 of the primary bitmap is on.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Bit 1 of the bitmap does NOT represent a data field — it is the flag indicating whether the secondary bitmap is present. That's why the first real data field starts at bit 2 (PAN).",
      },
      { type: "heading", level: 3, text: "Reading the bitmap byte by byte" },
      {
        type: "code",
        text:
`Hex bitmap:  F2 3C 24 81 28 C0 82 00
Binary:      11110010 00111100 00100100 10000001
             00101000 11000000 10000010 00000000
             │└──┬──┘ └──┬───┘ └──┬───┘ └──┬───┘
             │  bits     bits     bits     bits
             │  2-8      9-16    17-24    25-32
             │
             └─ bit 1: secondary bitmap present? (=1, yes)

Reading each bit left to right:
  Bit 1  = 1 → secondary bitmap present (fields 65-128 may exist)
  Bit 2  = 1 → field 2 (PAN) present
  Bit 3  = 1 → field 3 (Processing Code) present
  Bit 4  = 1 → field 4 (Amount, Transaction) present
  Bit 5  = 0 → field 5 absent
  Bit 6  = 0 → field 6 absent
  Bit 7  = 1 → field 7 (Transmission DateTime) present
  Bit 8  = 0 → field 8 absent
  ... and so on up to bit 64`,
      },
      {
        type: "callout",
        tone: "info",
        text:
          "To read manually: convert each hex pair to binary (e.g. F2 → 11110010). The most-significant bit (MSB) of each byte maps to the lowest field number in that group of 8.",
      },

      // ── 6. Data Elements ──────────────────────────────────────────────
      { type: "heading", level: 2, text: "Data Elements" },
      {
        type: "paragraph",
        text:
          "Each field has: number (1-128), name, encoding type (how the content is encoded), length type (fixed or variable) and max size.",
      },
      { type: "heading", level: 3, text: "Encoding types" },
      {
        type: "table",
        headers: ["Type", "Meaning", "Example"],
        rows: [
          ["n", "Numeric (0-9)", `"000001"`],
          ["a", "Alphabetic (A-Z, space)", `"PURCHASE"`],
          ["an", "Alphanumeric", `"STORE01"`],
          ["ans", "Alphanumeric + special", `"STORE/01"`],
          ["b", "Binary", "raw bytes"],
          ["z", "Magnetic track", `"4111=2512"`],
          ["x+n", "Sign (C/D) + numeric", `"C000000010000"`],
        ],
      },
      { type: "heading", level: 3, text: "Length types" },
      {
        type: "table",
        headers: ["Type", "Meaning"],
        rows: [
          ["FIXED", "Fixed length, always the same"],
          ["LLVAR", "2-digit length prefix + value (max 99)"],
          ["LLLVAR", "3-digit length prefix + value (max 999)"],
        ],
      },
      {
        type: "code",
        text:
`Example LLVAR — field 35 (Track 2) with value "4111111111111111=2512":

  20 4111111111111111=2512
  ┬─ ─────────────────────
  │           value (20 characters)
  │
  └ length "20" in 2 digits`,
      },

      // ── 7. Most important fields ──────────────────────────────────────
      { type: "heading", level: 2, text: "Most important fields" },
      {
        type: "paragraph",
        text:
          "The fields below appear in most transactions and are essential to read any ISO 8583 message — the ISOLeaf Builder and Parser highlight them too.",
      },

      { type: "heading", level: 3, text: "Bit 2 — PAN (Primary Account Number)" },
      {
        type: "paragraph",
        text:
          "Type: LLVAR n, max 19 digits. The card number. The first 6-8 digits form the BIN, which identifies the issuer and the brand. Always masked in the UI (e.g. 636368******4970).",
      },

      { type: "heading", level: 3, text: "Bit 3 — Processing Code" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 6. Six digits split into 3 sub-fields of 2 digits each — they describe what the transaction does, from which account and to which account.",
      },
      {
        type: "table",
        headers: ["Position", "Sub-field", "Common values"],
        rows: [
          ["1-2", "Transaction type", "00 = Purchase · 01 = Withdrawal · 20 = Refund · 30 = Inquiry"],
          ["3-4", "Account debited (from)", "00 = Default · 10 = Savings · 20 = Checking · 30 = Credit"],
          ["5-6", "Account credited (to)", "00 = Default · 10 = Savings · 20 = Checking · 30 = Credit"],
        ],
      },
      {
        type: "code",
        text:
`Examples:
  003000 → Credit purchase   (00 = purchase, 30 = credit,   00 = default)
  012020 → Cash withdrawal   (01 = withdraw, 20 = checking, 20 = checking)
  203000 → Refund / void of credit purchase`,
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Sub-fields 3-4 and 5-6 are not universal — each brand/acquirer can use proprietary combinations. Visa, Mastercard and Elo, for instance, diverge on a few values for debit single-pay vs. installments and credit vs. savings debit. Always check the processing-code catalog of the partner you integrate with.",
      },

      { type: "heading", level: 3, text: "Bit 4 — Amount, Transaction" },
      {
        type: "paragraph",
        text: "Type: FIXED n 12. Transaction amount in the smallest currency unit (e.g. cents), no decimal separator. Ex.: 000000018233 = USD 182.33.",
      },

      { type: "heading", level: 3, text: "Bit 7 — Transmission Date & Time" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 10. Format MMDDHHmmss (month, day, hour, minute, second) in UTC. Ex.: 0522104642 = May 22, 10:46:42.",
      },

      { type: "heading", level: 3, text: "Bit 11 — STAN (Systems Trace Audit Number)" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 6. Sequential transaction number generated by the terminal. Unique per terminal per day. Used for tracking and to correlate request and response. Ex.: 000042.",
      },

      { type: "heading", level: 3, text: "Bit 22 — POS Entry Mode" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 3. How the card was read by the terminal. Different from the application's \"channel\" abstraction — Bit 22 is what the terminal actually reported.",
      },
      {
        type: "table",
        headers: ["Value", "Channel", "Description"],
        rows: [
          ["010", "Manual / keyed", "PAN typed on the keypad"],
          ["021", "Magnetic stripe", "Track read"],
          ["051", "Chip (EMV)", "Chip contact, data validated"],
          ["071", "Contactless / NFC", "Card or phone tap"],
          ["090", "Stripe (chip fallback)", "Chip didn't read, fell back to stripe"],
          ["801", "Stripe, no CVV", "Fallback without PIN"],
        ],
      },

      { type: "heading", level: 3, text: "Bit 35 — Track 2 Data" },
      {
        type: "paragraph",
        text:
          "Type: LLVAR z, max 37 chars. Track 2 magnetic stripe data. Format: PAN=YYMM[Service Code][Discretionary data]. Ex.: 4111111111111111=25121011234567890. The \"=\" separator splits PAN from service data (originally D on the physical track, mapped to = on the wire).",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Track 2 carries sensitive card data. Never store or transmit it without encryption / tokenization (PCI DSS).",
      },

      { type: "heading", level: 3, text: "Bit 37 — RRN (Retrieval Reference Number)" },
      {
        type: "paragraph",
        text:
          "Type: FIXED an 12. Unique reference number assigned by the acquirer. Used to identify the transaction in reversals, chargebacks and reconciliation. Must be unique per day.",
      },

      { type: "heading", level: 3, text: "Bit 38 — Authorization ID Response" },
      {
        type: "paragraph",
        text:
          "Type: FIXED an 6. Authorization code returned by the issuer when the transaction is approved. Ex.: \"123456\". Present only in the response (0110 / 0210).",
      },

      { type: "heading", level: 3, text: "Bit 39 — Response Code" },
      {
        type: "paragraph",
        text:
          "Type: FIXED an 2. Authorization result. \"00\" = approved; other values indicate the rejection reason.",
      },
      {
        type: "table",
        headers: ["RC", "Meaning"],
        rows: [
          ["00", "Approved"],
          ["05", "Do not honor (generic decline)"],
          ["12", "Invalid transaction"],
          ["14", "Invalid PAN"],
          ["41", "Lost card"],
          ["43", "Stolen card"],
          ["51", "Insufficient funds"],
          ["54", "Expired card"],
          ["55", "Incorrect PIN"],
          ["57", "Transaction not permitted to cardholder"],
          ["62", "Restricted card"],
          ["91", "Issuer unavailable"],
        ],
      },

      { type: "heading", level: 3, text: "Bit 41 — Terminal ID" },
      { type: "paragraph", text: "Type: FIXED ans 8. Unique terminal identifier registered with the acquirer." },

      { type: "heading", level: 3, text: "Bit 42 — Merchant ID" },
      { type: "paragraph", text: "Type: FIXED ans 15. Unique identifier of the merchant." },

      { type: "heading", level: 3, text: "Bit 49 — Currency Code, Transaction" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 3. ISO 4217 currency code. 986 = BRL (Brazilian Real), 840 = USD, 978 = EUR.",
      },

      { type: "heading", level: 3, text: "Bit 52 — PIN Data" },
      {
        type: "paragraph",
        text:
          "Type: FIXED b 8. Encrypted PIN Block (8 bytes = 16 hex chars) in ISO 9564 format. Encrypted with the ZPK (Zone PIN Key) agreed between acquirer and brand.",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "The PIN Block is ultra-sensitive data. Never display it in clear text. ISOLeaf always shows it as ******** (masked).",
      },

      { type: "heading", level: 3, text: "Bit 55 — ICC Data (EMV)" },
      {
        type: "paragraph",
        text:
          "Type: LLLVAR b, max 255 bytes. EMV chip data in BER-TLV format. Carries the ARQC (chip cryptogram), ATC, TVR, AIP and dozens of other tags. See the \"EMV & Cryptography\" section for the full details.",
      },

      { type: "heading", level: 3, text: "Bit 90 — Original Data Elements" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 42. Present only in reversals (MTI 04xx). Carries the original transaction's data packed together: original MTI (4) + STAN (6) + DateTime (10) + RRN (12) + zero-padding up to 42.",
      },

      // ── 8. Annotated full message ─────────────────────────────────────
      { type: "heading", level: 2, text: "Annotated full message example" },
      {
        type: "paragraph",
        text:
          "To put everything together, here is an annotated example of a 0200 (financial request, credit purchase via chip) with TPDU. Each block of the example is a slice of the real ASCII wire.",
      },
      {
        type: "code",
        text:
`Full wire:
6000020001 0200 F23C248128C08200 16 4111111111111111 003000 000000018233 0522104642 000042 ...

Broken down:

  6000020001                       ← TPDU (5 bytes / 10 hex)
    60       protocol
    0002     origin NII (acquirer)
    0001     destination NII (brand)

  0200                             ← MTI (Financial Request)

  F23C248128C08200                 ← Primary bitmap (8 bytes)
    bit 1 = 1 → does it have a secondary bitmap? (this example
                doesn't — bit 1 is 0; F2 = 11110010)
    bits 2,3,4,7,11,12,...        → fields present

  16 4111111111111111              ← Bit 2 — PAN (LLVAR)
    "16" = length, then 16 PAN digits

  003000                           ← Bit 3 — Processing Code
    00 = purchase · 30 = credit · 00 = default

  000000018233                     ← Bit 4 — Amount (12 digits)
    USD 182.33

  0522104642                       ← Bit 7 — Transmission DateTime
    May 22 10:46:42 UTC

  000042                           ← Bit 11 — STAN
    42nd transaction of the day on this terminal

  ...                              ← remaining fields follow the
                                     bitmap order (12, 13, 14, 22,
                                     35, 37, 41, 42, 49, 52, 55 ...)`,
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "The example above is for illustration only — spaces and comments are for readability. To test in the Parser, use a real ISO 8583 message generated by the Builder (no spaces, no comments). The Parser accepts ASCII wire and binary-hex without separators.",
      },

      // ── 9. Wire formats ───────────────────────────────────────────────
      { type: "heading", level: 2, text: "Wire formats" },
      {
        type: "paragraph",
        text:
          "ISOLeaf automatically supports two transmission formats for the same ISO 8583 message:",
      },
      {
        type: "table",
        headers: ["Format", "Description", "Example (start)"],
        rows: [
          ["ASCII wire", "Fields represented as ASCII text", `"0200F23C...NJJZ3Z"`],
          ["Binary-hex", "Bytes in hexadecimal (each byte = 2 chars)", `"30323030463233..."`],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "ASCII wire and binary-hex are just different encodings of the same ISO 8583 message. The ISOLeaf Parser auto-detects which one was pasted — you don't have to specify.",
      },
      {
        type: "code",
        text:
`Same MTI "0200" in three representations:

  ASCII wire:     0200          (4 ASCII chars; bytes on wire: 30 32 30 30)
  Binary-hex:     30323030      (hex of the ASCII bytes above — 8 chars)
  Raw binary:     02 00         (2 binary bytes — NOT ASCII;
                                  rare in ISO 8583, common in EMV TLV)`,
      },
    ],
  },

  emv: {
    id: "emv",
    blocks: [
      // ── 1. What is EMV ──────────────────────────────────────────────
      { type: "heading", level: 2, text: "What is EMV" },
      {
        type: "paragraph",
        text:
          "Global standard (Europay, Mastercard, Visa) for chip transactions. Defines the communication between chip and terminal and the cryptographic mechanisms that authenticate each transaction.",
      },
      {
        type: "paragraph",
        text:
          "Unlike ISO 8583 (which defines the network message), EMV defines what happens BEFORE the message is sent: the generation of security data by the card's chip.",
      },

      // ── 2. Bit 55 — where the data comes from ──────────────────────
      { type: "heading", level: 2, text: "Bit 55 — where the data comes from" },
      {
        type: "paragraph",
        text:
          "Bit 55 is a composition of data from three distinct sources. Understanding this is key to knowing what can be manipulated in tests.",
      },
      { type: "svg", text: EMV_BIT55_ORIGINS_SVG },

      { type: "heading", level: 3, text: "Chip data (personalization)" },
      {
        type: "paragraph",
        text:
          "Tags the issuer wrote into the chip when the card was issued. They define the card's capabilities and configuration. ISOLeaf generates realistic values for these when you use the Builder with Chip channel.",
      },
      { type: "heading", level: 3, text: "Terminal data" },
      {
        type: "paragraph",
        text:
          "Tags the terminal adds to Bit 55. They describe the physical capabilities of the equipment. Values depend on how the terminal was configured.",
      },
      { type: "heading", level: 3, text: "Negotiated data" },
      {
        type: "paragraph",
        text:
          "Tags whose values result from the chip-terminal interaction during the transaction (before the ARQC is calculated). The TVR (Terminal Verification Results), for example, records the outcome of each check performed.",
      },
      { type: "heading", level: 3, text: "Chip-generated data per transaction" },
      {
        type: "paragraph",
        text:
          "The ARQC (tag 9F26) is calculated by the chip on every transaction. The ATC (tag 9F36) increments on every transaction — never repeats. These are the data that prove the physical chip was present.",
      },

      // ── 3. BER-TLV structure ───────────────────────────────────────
      { type: "heading", level: 2, text: "BER-TLV structure" },
      {
        type: "paragraph",
        text:
          "Bit 55 uses BER-TLV (Basic Encoding Rules — Tag Length Value), an encoding format derived from ASN.1.",
      },
      { type: "paragraph", text: "Each TLV element has 3 parts:" },
      {
        type: "table",
        headers: ["Part", "Size", "Description"],
        rows: [
          ["TAG", "1-2 bytes", "Identifies the field. If bits 4-0 = 11111, the next byte is part of the tag."],
          ["LENGTH", "1-3 bytes", "Short form: 1 byte (<128). Long form: 0x81+N or 0x82+NN."],
          ["VALUE", "N bytes", "Content of the field."],
        ],
      },
      {
        type: "code",
        text:
`Bit 55 (hex): 9F 26 08 A1 B2 C3 D4 E5 F6 07 08 9F 36 02 00 1E

Breakdown:
  9F 26              ← TAG 9F26 (2 bytes, since 9F = ...11111)
  08                 ← LENGTH = 8 bytes
  A1B2C3D4E5F60708   ← VALUE = ARQC (8 bytes)

  9F 36              ← TAG 9F36 (2 bytes)
  02                 ← LENGTH = 2 bytes
  00 1E              ← VALUE = ATC = 30 decimal (30th transaction)`,
      },
      {
        type: "callout",
        tone: "info",
        text:
          "ISOLeaf builds and parses BER-TLV automatically. Use EMV Data → Parse Bit 55 to break any Bit 55 into its tags. The parse is partial — if an unknown tag is found, it keeps parsing the next ones.",
      },

      // ── 4. Tag table ───────────────────────────────────────────────
      { type: "heading", level: 2, text: "Most important tags" },
      {
        type: "table",
        headers: ["Tag", "Name", "Origin", "Size", "Description"],
        rows: [
          ["9F26", "ARQC", "Chip/per-tx", "8 bytes", "Authorization cryptogram"],
          ["9F27", "CID", "Chip/per-tx", "1 byte", "Cryptogram type (80=ARQC)"],
          ["9F10", "IAD", "Chip/per-tx", "variable", "Issuer-internal data"],
          ["9F36", "ATC", "Chip/per-tx", "2 bytes", "Transaction counter"],
          ["9F37", "UN", "Terminal", "4 bytes", "Unpredictable number"],
          ["9F02", "Amount", "Terminal", "6 bytes", "Authorized amount"],
          ["9F03", "Amount Other", "Terminal", "6 bytes", "Additional amount"],
          ["9A", "Tx Date", "Terminal", "3 bytes", "Transaction date (YYMMDD)"],
          ["9C", "Tx Type", "Terminal", "1 byte", "Type (00=purchase, 01=cash)"],
          ["95", "TVR", "Negotiated", "5 bytes", "Terminal Verification Results"],
          ["82", "AIP", "Chip", "2 bytes", "Application Interchange Profile"],
          ["9F33", "Term Cap", "Terminal", "3 bytes", "Terminal capabilities"],
          ["8E", "CVM List", "Chip", "variable", "Cardholder verification methods"],
          ["9F34", "CVM Results", "Negotiated", "3 bytes", "Cardholder verification result"],
          ["9F35", "Term Type", "Terminal", "1 byte", "Terminal type"],
          ["9F1A", "Term Country", "Terminal", "2 bytes", "Terminal country"],
        ],
      },

      // ── 5. Derivation chain ────────────────────────────────────────
      { type: "heading", level: 2, text: "EMV derivation chain" },
      {
        type: "paragraph",
        text:
          "The ARQC is not magic — it is the last link in a key derivation chain that starts at the issuer's HSM and ends as 8 bytes in the ISO 8583 message.",
      },
      { type: "svg", text: EMV_DERIVATION_CHAIN_SVG },
      {
        type: "paragraph",
        text:
          "Each level uses the previous one plus a transaction-specific input. This ensures the key that computes the ARQC is unique to THAT transaction on that card — any replay is detectable by the issuer.",
      },

      // ── 6. The IMK in ISOLeaf ───────────────────────────────────────
      { type: "heading", level: 2, text: "The IMK in ISOLeaf" },
      { type: "heading", level: 3, text: "Why does ISOLeaf use the IMK?" },
      {
        type: "paragraph",
        text:
          "In production, the IMK is protected inside an HSM (Hardware Security Module) at the issuer — it is never exposed in cleartext.",
      },
      { type: "paragraph", text: "ISOLeaf uses the IMK for development and testing:" },
      {
        type: "list",
        items: [
          "Builder: when the IMK is configured in the Workspace, the Builder generates a cryptographically real ARQC instead of a random value. The \"✓ derived ARQC\" badge confirms it.",
          "Validate ARQC: checks whether a received ARQC is legitimate for a given IMK and PAN. Useful to test the issuer integration.",
          "Full Flow: runs the whole IMK → ICC MK → Session Key → ARQC validation → ARPC generation chain in a single step.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Use test IMKs only — never configure a production IMK in ISOLeaf or any development tool. In production, the IMK must only exist inside a certified HSM.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "To configure the IMK: Workspace → Cryptographic keys → Issuer Master Key (32 hex chars).",
      },

      // ── 7. ARPC ────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "ARPC — Issuer response" },
      {
        type: "paragraph",
        text:
          "After validating the ARQC, the issuer computes the ARPC to prove to the terminal that whoever responded is really the legitimate issuer. The ARPC goes in the response Bit 55 (tag 91).",
      },
      {
        type: "table",
        headers: ["Method", "Formula", "When to use"],
        rows: [
          ["Method 1", "3DES(Session Key, ARQC XOR RC)", "Visa CVN 10/18, Elo"],
          ["Method 2", "MAC(Session Key, CSU || data)", "Mastercard M/Chip"],
        ],
      },
      {
        type: "paragraph",
        text:
          "Where RC = Response Code (2 bytes from bit 39: \"00\" = approved) and CSU = Card Status Update (4 bytes — allows updating the chip status).",
      },

      // ── 8. Decoders coming soon ────────────────────────────────────
      { type: "heading", level: 2, text: "Tag decoders — coming soon" },
      {
        type: "paragraph",
        text:
          "Some Bit 55 tags are bitmaps where each bit has a specific meaning. ISOLeaf plans to ship visual decoders for these tags.",
      },
      { type: "heading", level: 3, text: "TVR (Tag 95) — Terminal Verification Results" },
      { type: "paragraph", text: "5 bytes = 40 bits, each indicating one verification:" },
      {
        type: "table",
        headers: ["Bit", "Position", "Meaning"],
        rows: [
          ["Bit 1",  "1.8", "Offline data auth not performed"],
          ["Bit 2",  "1.7", "SDA failed"],
          ["Bit 3",  "1.6", "ICC data missing"],
          ["Bit 4",  "1.5", "Card on terminal exception file"],
          ["Bit 5",  "1.4", "DDA failed"],
          ["Bit 6",  "1.3", "CDA failed"],
          ["Bit 7",  "2.8", "ICC and terminal have different app versions"],
          ["Bit 8",  "2.4", "Invalid PIN entered"],
          ["Bit 9",  "2.3", "PIN entry bypassed"],
          ["Bit 10", "3.8", "Offline transaction limit exceeded"],
          ["Bit 11", "4.8", "Transaction randomly selected for review"],
          ["Bit 12", "5.8", "Merchant forced transaction online"],
        ],
      },
      { type: "heading", level: 3, text: "AIP (Tag 82) — Application Interchange Profile" },
      { type: "paragraph", text: "2 bytes indicating what the card supports:" },
      {
        type: "table",
        headers: ["Bit", "Meaning"],
        rows: [
          ["1.7", "SDA supported"],
          ["1.6", "DDA supported"],
          ["1.5", "Cardholder verification supported"],
          ["1.4", "Terminal risk management required"],
          ["1.3", "Issuer authentication supported"],
          ["1.1", "CDA supported"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Decoders for TVR, AIP, TTQ, CVM List and other bitmap tags are on the ISOLeaf roadmap. When available, they will appear automatically in EMV Data → Parse Bit 55.",
      },
    ],
  },

  roles: {
    id: "roles",
    blocks: [
      // ── 1. Participants ────────────────────────────────────────────
      { type: "heading", level: 2, text: "Participants in a transaction" },
      { type: "heading", level: 3, text: "CARDHOLDER" },
      { type: "paragraph", text: "The card owner who performs the purchase." },
      { type: "heading", level: 3, text: "MERCHANT" },
      { type: "paragraph", text: "The store that accepts the payment." },
      { type: "heading", level: 3, text: "TERMINAL / POS" },
      { type: "paragraph", text: "The device that captures card data and sends the ISO 8583 message to the acquirer." },
      { type: "heading", level: 3, text: "ACQUIRER" },
      {
        type: "paragraph",
        text:
          "Connects the merchant to the network. Receives the message from the terminal and routes it to the brand network. Examples: Cielo, Rede, Stone, GetNet.",
      },
      { type: "heading", level: 3, text: "BRAND / NETWORK" },
      {
        type: "paragraph",
        text:
          "Operates the payment network. Routes the message from the acquirer to the issuer and defines authorization rules. Examples: Visa, Mastercard, Elo, Amex.",
      },
      { type: "heading", level: 3, text: "ISSUER" },
      {
        type: "paragraph",
        text:
          "The bank or institution that issued the card. Authorizes or declines the transaction — validates the ARQC, balance, limit, etc.",
      },
      { type: "heading", level: 3, text: "PROCESSOR" },
      {
        type: "paragraph",
        text:
          "In some models the processor sits between the brand and the issuer — performing authorization on the issuer's behalf. Common with smaller issuers that outsource processing.",
      },

      // ── 2. Four-leg flow ──────────────────────────────────────────
      { type: "heading", level: 2, text: "The four-leg flow" },
      {
        type: "paragraph",
        text:
          "A complete transaction traverses up to four participants in sequence. Each connection between two of them is called a \"leg\" — and each leg can use a different transport protocol.",
      },
      { type: "svg", text: FOUR_LEGS_FLOW_SVG },
      {
        type: "paragraph",
        text:
          "Each leg can use a different protocol. The TPDU (Transport Protocol Data Unit) is typically required on legs 2 and 3 (between financial institutions), while leg 1 (terminal → acquirer) often uses proprietary protocols without TPDU.",
      },
      {
        type: "paragraph",
        text:
          "On the response side, the ARPC computed by the issuer travels back along the same path (Brand → Acquirer → Terminal). The terminal hands the ARPC to the chip, which validates it and approves or rejects locally.",
      },

      // ── 2b. ISO 8583 message classes ──────────────────────────────
      { type: "heading", level: 2, text: "ISO 8583 message classes" },
      {
        type: "paragraph",
        text:
          "The MTI's second digit defines the message CLASS. Understanding this distinction is fundamental to building correct messages and integrating with any network.",
      },
      {
        type: "table",
        headers: ["Class", "MTIs", "Type", "Description"],
        rows: [
          ["1xx", "0100 / 0110 / 0120 / 0130", "Authorization", "In-store purchases, inquiries, pre-authorizations"],
          ["2xx", "0200 / 0210 / 0220 / 0230", "Financial", "Transactions with immediate financial movement (ATM, withdrawals, deposits)"],
          ["4xx", "0400 / 0410 / 0420 / 0430", "Reversal", "Cancellation of a previous transaction (1xx or 2xx)"],
          ["8xx", "0800 / 0810 / 0820 / 0830", "Network", "Echo test, sign-on / off, key exchange, cutover"],
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Critical distinction between 0100 and 0200. 0100 — Authorization: the customer swipes the card in a store, pharmacy, restaurant, gas station… The issuer authorizes the operation; the actual debit happens later during clearing. 0200 — Financial: ATM events (withdrawal, deposit, PIN change) — transactions that move money instantly, without a separate clearing step. This is one of the most common integration mistakes: using 0200 for an in-store purchase or 0100 for an ATM withdrawal.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Proprietary networks often define custom MTIs for functionality beyond the ISO 8583 standard, such as balance inquiries, bill payments, and network-specific services. These MTIs vary by network and are defined in each operator's technical specification — consult the documentation of the network you are integrating with. ISOLeaf supports custom MTIs via the \"Unknown MTI\" setting in the Simulator.",
      },

      // ── 3. Entry modes ────────────────────────────────────────────
      { type: "heading", level: 2, text: "Entry mode — how the card was read" },
      {
        type: "paragraph",
        text:
          "Bit 22 (POS Entry Mode) tells how the card was captured. It completely changes what is expected in the message.",
      },
      {
        type: "table",
        headers: ["Code", "Mode", "Bit 35", "Bit 52", "Bit 55", "Typical use"],
        rows: [
          ["051", "Chip (ICC)", "Present", "Optional", "Present", "In-store purchase with chip"],
          ["090", "Magnetic stripe", "Present", "Optional", "Absent", "Stripe fallback"],
          ["071", "Contactless chip", "Present", "Absent", "Present", "NFC / tap to pay"],
          ["075", "Contactless stripe", "Present", "Absent", "Absent", "NFC without chip"],
          ["010", "PAN keyed (manual)", "Absent", "Absent", "Absent", "MOTO, call center"],
          ["081", "e-Commerce", "Absent", "Absent", "Absent", "Online purchase"],
          ["901", "Fallback (chip→stripe)", "Present", "Absent", "Absent", "Faulty chip"],
        ],
      },

      { type: "heading", level: 3, text: "Technical differences by entry mode" },

      { type: "heading", level: 4, text: "Chip (051)" },
      {
        type: "paragraph",
        text:
          "The chip generates the ARQC using the ICC Master Key derived from the IMK. Bit 55 is mandatory and contains the authentication cryptogram. The issuer validates the ARQC to confirm that the physical chip participated in the transaction — the main anti-fraud protection. Bit 35 (Track 2) is also captured from the chip.",
      },

      { type: "heading", level: 4, text: "Magnetic stripe (090)" },
      {
        type: "paragraph",
        text:
          "No cryptogram — only stripe data is sent. Bit 35 contains PAN + expiry + service code + discretionary data. More fraud-prone — data can be cloned. In many networks, stripe transactions from chip cards are treated with more suspicion (downgrade attack).",
      },

      { type: "heading", level: 4, text: "Contactless (071)" },
      {
        type: "paragraph",
        text:
          "The NFC chip generates an ARQC different from contact — using TTQ (Terminal Transaction Qualifiers, tag 9F66) and CTQ (Card Transaction Qualifiers, tag 9F6C) to negotiate what happens offline vs online. Low-value transactions can be approved offline by the chip without ever reaching the issuer.",
      },

      { type: "heading", level: 4, text: "CNP — Card Not Present (010, 081)" },
      {
        type: "paragraph",
        text:
          "No physical card data — only PAN, expiry and CVV2. Higher fraud risk — requires additional controls: CVV2 (printed on the card), 3D Secure, risk analysis. Bit 61 or private fields carry additional e-commerce data (URL, device fingerprint, etc.).",
      },

      // ── 4. Who decides which fields are required ──────────────────
      { type: "heading", level: 2, text: "Who decides which fields are mandatory?" },
      {
        type: "paragraph",
        text:
          "ISO 8583 only defines the structure and meaning of each field — it does not define which ones are mandatory. Each brand and network defines its own rules.",
      },
      {
        type: "table",
        headers: ["Level", "Defined by", "Example"],
        rows: [
          ["ISO 8583", "The standard", "Structure and encoding only"],
          ["Brand", "Visa, Mastercard, Elo…", "Bit 19 mandatory (Visa), Bit 43 (MC)"],
          ["Acquirer", "Cielo, Rede, Stone…", "Private fields (Bit 47 / 48)"],
          ["Issuer", "Issuing bank", "May require extra data on the response"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "In the ISOLeaf Builder, the selected role (Acquirer, Brand, Issuer) determines which fields are automatically included in the generated message, following the most common Brazilian-market conventions.",
      },

      // ── 5. Processing Code ────────────────────────────────────────
      { type: "heading", level: 2, text: "Processing Code — the transaction's DNA" },
      {
        type: "paragraph",
        text:
          "Bit 3 (Processing Code) defines what the transaction does with the cardholder's accounts. 6 digits in 3 subfields. Common examples in the Brazilian market:",
      },
      {
        type: "table",
        headers: ["Processing Code", "Transaction", "Description"],
        rows: [
          ["003000", "Credit purchase", "Debits cardholder's credit account"],
          ["003010", "Credit installment (merchant)", "Merchant-funded installments"],
          ["003030", "Credit installment (issuer)", "Bank-funded installments"],
          ["012020", "Cash withdrawal", "Debits checking account"],
          ["012030", "Credit cash advance", "Cash on credit line (rare)"],
          ["172020", "Balance inquiry", "Doesn't move money"],
          ["202020", "Debit refund", "Credits the checking account"],
          ["203000", "Credit refund", "Credit-line reversal"],
          ["302020", "Statement inquiry", "Informational only"],
          ["602020", "Bill payment", "Credits the beneficiary"],
        ],
      },

      // ── 6. Airline ─────────────────────────────────────────────────
      { type: "heading", level: 2, text: "Airline transactions" },
      {
        type: "paragraph",
        text:
          "Airline transactions have unique characteristics that distinguish them from a regular in-store purchase. The exact ticket value is often unknown at booking time (fares, taxes, upgrades), so the flow uses pre-authorization + capture (completion).",
      },

      { type: "heading", level: 3, text: "Typical flow — airline transaction" },
      {
        type: "list",
        ordered: true,
        items: [
          "PRE-AUTHORIZATION (0100 / 0200) — MCC 4511 (Air Carriers, Airlines), Processing Code 003000, estimated or minimum fare value. The issuer blocks the amount on the cardholder's account but does not debit yet.",
          "COMPLETION / CAPTURE (0220 — Advice) — after ticket confirmation. Final value with all fees included. May be higher or lower than the pre-authorization. Bit 90 may carry the original pre-authorization data.",
          "CANCELLATION (0420 — Reversal Advice) — if the passenger cancels before ticketing, releases the blocked amount on the account.",
        ],
      },

      { type: "heading", level: 3, text: "Airline-specific data" },
      {
        type: "paragraph",
        text:
          "Brands define specific fields for flight data. They usually live in private fields (Bit 47, 48 or 127) or in specific fields like Bit 111 on some networks.",
      },
      {
        type: "table",
        headers: ["Field", "Common flight data"],
        rows: [
          ["Bit 43", "Card acceptor name with city / airport"],
          ["Bit 47 / 48", "Private data: PNR, flight number, origin / destination"],
          ["Bit 111", "Airline Additional Data (some networks)"],
        ],
      },

      { type: "heading", level: 3, text: "Airline terminology" },
      {
        type: "list",
        items: [
          "PNR (Passenger Name Record): unique reservation identifier in the airline's system. Ex.: \"ABC123\".",
          "Leg Data: data for each flight segment (origin, destination, date, class, flight number).",
          "IATA Code: 2-3 letter airline code (LA = LATAM, G3 = Gol).",
          "Ticket Number: electronic ticket (e-ticket) number.",
          "EMD (Electronic Miscellaneous Document): document for ancillary services (extra baggage, upgrades, etc.).",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Airline-data implementations vary widely across brands and acquirers. Visa, Mastercard and Elo each have their own specifications for these fields. Consult the specific brand's technical specification for production implementation.",
      },

      // ── 7. Other special transactions ─────────────────────────────
      { type: "heading", level: 2, text: "Other special transaction types" },

      { type: "heading", level: 3, text: "Bill payment / direct debit" },
      {
        type: "paragraph",
        text:
          "Processing Code 60xxxx. Used for paying bills (utilities, taxes, etc.). Direct credit to the beneficiary's account.",
      },

      { type: "heading", level: 3, text: "Prepaid top-up" },
      {
        type: "paragraph",
        text:
          "Prepaid cards have a different flow. The issuer is usually a prepaid-card processor. Top-ups can be done via Bit 4 with a specific Processing Code.",
      },

      { type: "heading", level: 3, text: "Cashback" },
      {
        type: "paragraph",
        text:
          "Processing Code 09xxxx (cash withdrawal embedded in the purchase). Bit 4 = purchase amount + cash amount. Bit 54 = breakdown of each portion (purchase separated from cash). Allowed on some terminals and specific networks.",
      },

      // ── 8. How to test in ISOLeaf ──────────────────────────────────
      { type: "heading", level: 2, text: "How to use ISOLeaf to test these scenarios" },
      {
        type: "table",
        headers: ["Scenario", "MTI", "Class", "Channel", "Description"],
        rows: [
          ["In-store credit purchase (chip)",     "0100", "Authorization", "Chip",      "Customer pays at a merchant with chip"],
          ["In-store credit purchase (stripe)",   "0100", "Authorization", "Stripe",    "Customer pays at a merchant with magstripe"],
          ["In-store debit purchase (chip)",      "0100", "Authorization", "Chip",      "Debit purchase with PIN at the merchant"],
          ["Online / CNP purchase",               "0100", "Authorization", "CNP",       "E-commerce, MOTO, no physical card"],
          ["Pre-authorization (gas / hotel)",     "0100", "Authorization", "Chip",      "Reserves an amount, adjusted at checkout"],
          ["ATM cash withdrawal",                 "0200", "Financial",     "Chip",      "Cash withdrawal at an ATM"],
          ["ATM PIN change",                      "0200", "Financial",     "Chip",      "PIN change at the ATM"],
          ["ATM deposit",                         "0200", "Financial",     "Chip",      "Immediate account credit via ATM"],
          ["Proprietary transactions",            "Varies per network", "Proprietary", "Chip", "Custom MTIs defined by the network (consult the network's technical specification)"],
          ["Purchase reversal",                   "0400", "Reversal",      "(same)",    "Cancels a previous 0100 authorization"],
          ["Withdrawal reversal",                 "0400", "Reversal",      "(same)",    "Cancels a previous 0200 financial"],
          ["Echo test",                           "0800", "Network",       "(n/a)",     "Checks connectivity with issuer / brand"],
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "The \"Proprietary transactions\" row uses a custom MTI — it is NOT an ISO 8583 standard. Each network defines its own MTIs for functionality beyond the standard's scope. To simulate these MTIs in ISOLeaf, configure the Simulator session with \"Unknown MTI: Custom\" and set the matching response MTI.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "In the ISOLeaf Builder: In-store purchase → MTI 0100, Role Acquirer. ATM withdrawal → MTI 0200, Role Acquirer, Type Cash. Reversal → use \"Create reversal\" in the MessagePreview (generates 0400 with Bit 90 auto-filled). Echo test → MTI 0800.",
      },
    ],
  },

  fields: {
    id: "fields",
    blocks: [
      { type: "paragraph", text: "Reference table of the most important ISO 8583 Data Elements (bits 2-128)." },
      {
        type: "table",
        headers: ["Bit", "Name", "Type", "Enc.", "Size", "Description"],
        rows: [
          ["2", "PAN", "LLVAR", "n", "max 19", "Card number"],
          ["3", "Processing Code", "FIXED", "n", "6", "Transaction type"],
          ["4", "Amount, Transaction", "FIXED", "n", "12", "Amount in cents"],
          ["5", "Amount, Settlement", "FIXED", "n", "12", "Settlement amount"],
          ["6", "Amount, Cardholder Billing", "FIXED", "n", "12", "Billing amount"],
          ["7", "Transmission Date & Time", "FIXED", "n", "10", "MMDDHHmmss"],
          ["11", "STAN", "FIXED", "n", "6", "Trace number"],
          ["12", "Local Transaction Time", "FIXED", "n", "6", "HHmmss"],
          ["13", "Local Transaction Date", "FIXED", "n", "4", "MMDD"],
          ["14", "Expiration Date", "FIXED", "n", "4", "YYMM"],
          ["18", "Merchant Type (MCC)", "FIXED", "n", "4", "Merchant category"],
          ["19", "Acquiring Country Code", "FIXED", "n", "3", "Acquirer country"],
          ["22", "POS Entry Mode", "FIXED", "n", "3", "How the card was read"],
          ["25", "POS Condition Code", "FIXED", "n", "2", "POS condition"],
          ["32", "Acquiring Institution ID", "LLVAR", "n", "max 11", "Acquirer ID"],
          ["35", "Track 2 Data", "LLVAR", "z", "max 37", "Magnetic stripe data"],
          ["37", "RRN", "FIXED", "an", "12", "Reference number"],
          ["38", "Authorization ID Response", "FIXED", "an", "6", "Auth code"],
          ["39", "Response Code", "FIXED", "an", "2", "'00' = approved"],
          ["41", "Terminal ID", "FIXED", "ans", "8", "Terminal ID"],
          ["42", "Merchant ID", "FIXED", "ans", "15", "Merchant ID"],
          ["43", "Card Acceptor Name/Location", "FIXED", "ans", "40", "Merchant name + city"],
          ["48", "Additional Data — Private", "LLLVAR", "an", "max 999", "Private data"],
          ["49", "Currency Code, Transaction", "FIXED", "n", "3", "986 = BRL"],
          ["52", "PIN Data", "FIXED", "b", "8", "PIN Block (binary)"],
          ["54", "Additional Amounts", "LLLVAR", "an", "max 120", "Extra amounts"],
          ["55", "ICC Data (EMV)", "LLLVAR", "b", "max 255", "Chip data BER-TLV"],
          ["57-63", "Reserved National/Private", "LLLVAR", "ans", "max 999", "Reserved national/private"],
          ["64", "MAC", "FIXED", "b", "8", "Message authentication"],
          ["70", "Network Management Info Code", "FIXED", "n", "3", "0800/0810"],
          ["90", "Original Data Elements", "FIXED", "n", "42", "Original msg data (reversal)"],
          ["100", "Receiving Institution ID", "LLVAR", "n", "max 11", "Issuer ID"],
          ["127", "Private Use", "LLLVAR", "ans", "max 999", "Private use"],
          ["128", "MAC (Extended)", "FIXED", "b", "8", "Extended MAC"],
        ],
      },
      { type: "heading", level: 3, text: "Encoding types" },
      {
        type: "list",
        items: [
          "n = numeric (digits 0-9)",
          "a = alphabetic (A-Z, space)",
          "s = special (special characters)",
          "an = alphanumeric",
          "ans = alphanumeric + special",
          "b = binary",
          "z = magnetic track (digits + separators)",
          "x+n = sign (C/D) + numeric",
        ],
      },
      { type: "heading", level: 3, text: "Length types" },
      {
        type: "list",
        items: [
          "FIXED = fixed length",
          "LLVAR = 2-digit length prefix + value (max 99)",
          "LLLVAR = 3-digit length prefix + value (max 999)",
        ],
      },
    ],
  },

  iso20022: {
    id: "iso20022",
    blocks: [
      // ── 1. What is ISO 20022 ─────────────────────────────────────
      { type: "heading", level: 2, text: "What is ISO 20022" },
      {
        type: "paragraph",
        text:
          "ISO 20022 is the international standard for structured financial messages in XML. Unlike ISO 8583 (positional fields in a flat message) and ISO 15022 / SWIFT MT (colon-delimited text blocks), ISO 20022 describes each message via a versioned XSD — a machine-to-machine contract that carries semantics (currencies, identities, hierarchy) instead of positions.",
      },
      {
        type: "paragraph",
        text:
          "It is the practical successor to ISO 15022/MT in the banking world and the standard adopted by Brazil's SPI/BCB for Pix and by SWIFT under the CBPR+ (Cross-Border Payments and Reporting Plus) program. The same XSD skeleton is reused by different ecosystems — what changes is mandatoriness, cardinality and local business rules.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "In day-to-day integration work you don't write XML \"by hand\": you compose a message against an XSD, validate it against the schema and ship the result. ISOLeaf covers the full cycle — Parser, Reference, Validator, Version Comparator, Builder and Flow Visualizer all operate on the same library of official XSDs.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "ISO 20022 field reference is dynamic — unlike ISO 8583, whose 128 Data Elements are fixed and therefore get the static **Field Reference (ISO 8583)** page in this documentation, the ISO 20022 field set depends on which XSD (and which version) you are consuming, including custom XSDs you have uploaded via Workspace. That's why the field-tree explorer lives **inside ISOLeaf itself**, in the **Field Reference** module (ISO 20022 → Generic → Field reference in the menu): there you browse the real XSD the Agent loaded, with cross search by field name across every family and version.",
      },

      // ── 2. Structure of a message ────────────────────────────────
      { type: "heading", level: 2, text: "Structure of an ISO 20022 message" },
      {
        type: "paragraph",
        text:
          "A full message is always envelope + body. The envelope may include a Business Application Header (AppHdr) carrying routing metadata (sender, recipient, priority, correlation); the body is the Document, whose contents vary by message type — pacs.008 for an interbank credit, pain.001 for a payment initiation, camt.053 for a statement.",
      },
      {
        type: "code",
        lang: "xml",
        text:
`<!-- Typical envelope (AppHdr + Document) -->
<Envelope>
  <AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
    <Fr><FIId><FinInstnId><BICFI>BANKBRSPXXX</BICFI></FinInstnId></FIId></Fr>
    <To><FIId><FinInstnId><BICFI>BANKBRRJXXX</BICFI></FinInstnId></FIId></To>
    <BizMsgIdr>MSG-2026-00001</BizMsgIdr>
    <MsgDefIdr>pacs.008.001.13</MsgDefIdr>
    <CreDt>2026-07-10T14:30:00Z</CreDt>
  </AppHdr>
  <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13">
    <FIToFICstmrCdtTrf>
      <GrpHdr>
        <MsgId>MSG-2026-00001</MsgId>
        <CreDtTm>2026-07-10T14:30:00Z</CreDtTm>
        <NbOfTxs>1</NbOfTxs>
        <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
      </GrpHdr>
      <CdtTrfTxInf>
        <PmtId>
          <InstrId>INSTR-001</InstrId>
          <EndToEndId>E12345678202607101430000000000001</EndToEndId>
        </PmtId>
        <!-- Debtor, Creditor, Amount ... -->
      </CdtTrfTxInf>
    </FIToFICstmrCdtTrf>
  </Document>
</Envelope>`,
      },
      { type: "heading", level: 3, text: "AppHdr (Business Application Header, head.001)" },
      {
        type: "paragraph",
        text:
          "AppHdr is the \"postal envelope\": it states the sender (Fr), the recipient (To), the business identifier (BizMsgIdr), the definition of the transported message (MsgDefIdr, e.g. pacs.008.001.13) and the creation timestamp (CreDt). Not every ecosystem requires AppHdr — SPI, for instance, uses only the Document on the SPI↔PSP boundary — but in network scenarios (SWIFT CBPR+) it is mandatory.",
      },
      { type: "heading", level: 3, text: "Document" },
      {
        type: "paragraph",
        text:
          "Document is the body. The root element varies by message (FIToFICstmrCdtTrf for pacs.008, CstmrCdtTrfInitn for pain.001, BkToCstmrStmt for camt.053). All of them share the GrpHdr (batch metadata) + N transactions structure — what changes is the message-specific fields and mandatoriness.",
      },

      // ── 3. XSD and versioning ────────────────────────────────────
      { type: "heading", level: 2, text: "XSD and versioning" },
      {
        type: "paragraph",
        text:
          "Every ISO 20022 message has its own XSD and is identified by a canonical namespace. Reading the namespace equals reading the message type + version — there is no separate \"version\" field.",
      },
      {
        type: "code",
        lang: "text",
        text:
`Namespace format:
  urn:iso:std:iso:20022:tech:xsd:{msgType}.{msgVar}.{msgId}.{version}

Example (pacs.008 version 13):
  urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13
                                  │    │   │  │
                                  │    │   │  └─ version (2 digits)
                                  │    │   └──── message id (3 digits, almost always 001)
                                  │    └──────── variant (3 digits, almost always 001)
                                  └───────────── family prefix (pacs/pain/camt/head)`,
      },
      {
        type: "paragraph",
        text:
          "It is common to find several versions coexisting in production. The reason is that different groups (banks, clearing houses, networks) evolve at different paces: one PSP may still emit pacs.008.001.09 while another already publishes pacs.008.001.13, and the destination network must accept both until the sunset schedule closes. ISOLeaf's Version Comparator exists precisely to diff two versions of the same message and show which fields were added, removed or had their cardinality/type changed.",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "The version is part of the namespace, not an XML attribute. Swapping pacs.008.001.09 for pacs.008.001.13 means swapping the xmlns value of the Document — the XSD, elements and rules may change between one version and the next. Never assume equivalence without a diff.",
      },

      // ── 4. Message families ──────────────────────────────────────
      { type: "heading", level: 2, text: "Message families" },
      {
        type: "paragraph",
        text:
          "The 4-letter prefix at the start of the XSD name identifies the family. Each family covers a functional domain and clusters semantically related messages — you can infer the purpose from the prefix alone.",
      },
      {
        type: "table",
        headers: ["Family", "Domain", "Purpose", "Examples supported in ISOLeaf"],
        rows: [
          ["camt", "Cash management & reporting", "Statements, debit/credit notifications, cancellations and status inquiries.", "camt.052, camt.053, camt.054, camt.056, camt.060"],
          ["pacs", "Payments clearing & settlement", "Interbank instructions — the \"wire\" between financial institutions settling orders.", "pacs.002, pacs.004, pacs.008, pacs.009, pacs.028"],
          ["pain", "Payment initiation", "Customer → bank: credit initiation, direct debit, Pix Automático mandates and status reports back to the customer.", "pain.001, pain.002, pain.009, pain.012"],
          ["head", "Business Application Header", "Routing envelope shared by every family — who sends, who receives, which message.", "head.001"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Rule of thumb: pain.* originates at the customer and lives on the customer↔bank boundary. pacs.* lives between banks (interbank). camt.* closes the cycle with information (statements, notifications, status). head.001 wraps any of them when the network requires a business envelope.",
      },

      // ── 5. Official references ───────────────────────────────────
      { type: "heading", level: 2, text: "Official references" },
      {
        type: "paragraph",
        text:
          "The canonical specs live on the regulator sites — there is no substitute for the original documents when you're closing an integration.",
      },
      {
        type: "list",
        items: [
          "[Official ISO 20022](https://www.iso20022.org/) — standard portal, maintained by the ISO 20022 Registration Management Group (RMG).",
          "[Message catalogue](https://www.iso20022.org/catalogue-messages) — complete list of messages with XSDs, examples and version history.",
          "[Pix / BCB](https://www.bcb.gov.br/estabilidadefinanceira/pix) — Pix page on the Brazilian Central Bank site, with regulation and timelines.",
          "[Pix Initiation Standards Manual (PDF)](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf) — BCB technical manual with formats for EndToEndId, MsgId, ISPB, cardinalities and mandatory scenarios (Portuguese).",
          "[SWIFT CBPR+](https://www.swift.com/standards/iso-20022/iso-20022-standards) — SWIFT's CBPR+ program: usage profiles, guidelines and MT↔MX coexistence.",
        ],
      },
      {
        type: "callout",
        tone: "success",
        text:
          "ISOLeaf ships the XSDs for these ecosystems bundled under /Schemas. You don't need to download each file manually to validate a message — but for doubts about a specific rule, the official document is always the source of truth.",
      },
    ],
  },

  iso20022Roles: {
    id: "iso20022Roles",
    blocks: [
      // ── 1. Pix ecosystem participants ────────────────────────────
      { type: "divider" },
      { type: "heading", level: 2, text: "Pix ecosystem participants" },
      {
        type: "paragraph",
        text:
          "In Pix, the interbank flow is mediated by the Instant Payment System (SPI) operated by the Brazilian Central Bank. PSPs (Payment Service Providers — banks, fintechs, credit unions) talk to SPI via ISO 20022 messages; SPI performs settlement in real time on each participant's Reserve account.",
      },
      { type: "svg", text: PIX_CREDIT_TRANSFER_FLOW_SVG },
      { type: "heading", level: 3, text: "Payer PSP" },
      {
        type: "paragraph",
        text:
          "The PSP serving the payer customer. Receives the user's order (via app, API or payment initiator), composes the pacs.008 with payer and payee data and sends it to SPI. Responsible for debiting the customer's account and for AML/CFT screening before forwarding.",
      },
      { type: "heading", level: 3, text: "Payee PSP" },
      {
        type: "paragraph",
        text:
          "The PSP serving the payee customer. Receives the final instruction (pacs.008) from SPI and credits the customer's account, typically notifying via camt.054. Also owns the DICT keys (CPF/CNPJ/email/phone/EVP) tied to its customer.",
      },
      { type: "heading", level: 3, text: "SPI/BCB" },
      {
        type: "paragraph",
        text:
          "The core operated by the Central Bank: receives pacs.008 from the Payer PSP, validates limits and formats, executes settlement (debit on the payer's Reserve, credit on the payee's Reserve) and forwards the instruction to the Payee PSP. Emits pacs.002 with a confirmation (ACCP/ACSC) or pacs.004 on return. The full format rules (32-char EndToEndId, ISPB, MsgId) live in BCB's Pix Initiation Standards Manual, linked in the ISO 20022 section of this guide.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Simplified flow: user → Payer PSP → SPI → Payee PSP → user. All SPI communication uses ISO 20022 (pacs.008 outbound, pacs.002 back, pacs.004 on returns, camt.054 for credit notification).",
      },

      // ── 2. SWIFT CBPR+ ecosystem participants ────────────────────
      { type: "divider" },
      { type: "heading", level: 2, text: "SWIFT CBPR+ ecosystem participants" },
      {
        type: "paragraph",
        text:
          "CBPR+ (Cross-Border Payments and Reporting Plus) is SWIFT's program that migrates cross-border payments from MT (text blocks) to ISO 20022 (XML). The logical flow is the same as with MTs: originating bank's customer ⇒ SWIFT ⇒ beneficiary bank — only the wire format changes.",
      },
      { type: "svg", text: MT103_DIRECT_FLOW_SVG },
      { type: "heading", level: 3, text: "Debtor Agent (originating bank)" },
      {
        type: "paragraph",
        text:
          "The paying customer's bank (Debtor). Receives the order from the customer and emits a pacs.008 (or pacs.009 for pure interbank) toward the beneficiary bank via the SWIFT network. Assigns the UETR (Unique End-to-end Transaction Reference) — a global identifier that follows the operation across every hop.",
      },
      { type: "heading", level: 3, text: "SWIFT (network)" },
      {
        type: "paragraph",
        text:
          "Carries messages between banks and provides tracking (gpi Tracker), BIC directory (SWIFTRef) and compliance validation (HVPS+ / CBPR+ guidelines). In correspondent-banking payments, the network may accommodate intermediary banks (Intermediary Agent) bridging when no direct account exists between originator and beneficiary.",
      },
      { type: "heading", level: 3, text: "Creditor Agent (beneficiary bank)" },
      {
        type: "paragraph",
        text:
          "The receiving customer's bank (Creditor). Receives pacs.008/pacs.009 from SWIFT, credits the customer's account and emits camt.054 (notification) or pacs.002 (confirmation back to the sender). May also generate camt.053 for the consolidated end-of-day statement.",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Conceptual difference between Pix and CBPR+: in Pix, SPI is a single clearing house (BCB) that actually settles. In CBPR+, SWIFT is a messaging network — settlement happens on correspondents, local clearing houses (Fedwire, TARGET2) or via cover. That's why pacs.009 (cover payment) and the Intermediary Agent field are especially relevant in CBPR+.",
      },
    ],
  },

  glossary: {
    id: "glossary",
    blocks: [
      // ── ISO 8583 / EMV terms ─────────────────────────────────────
      { type: "heading", level: 3, text: "ISO 8583 / EMV terms" },
      {
        type: "table",
        headers: ["Term", "Definition"],
        rows: [
          ["ARC", "Authorization Response Code — issuer response code in EMV format. Tag 8A. Same as RC (bit 39) in TLV form."],
          ["ARPC", "Application Response Cryptogram — issuer-generated cryptogram in response to the ARQC. Tag 91. Proves the issuer is legitimate."],
          ["ARQC", "Application Request Cryptogram — chip-generated cryptogram authenticating the transaction. Bit 55, tag 9F26. 8 bytes."],
          ["ATC", "Application Transaction Counter — sequential counter in the chip. Increments per transaction. Used in Session Key derivation."],
          ["BIN", "Bank Identification Number — first 6-8 digits of the PAN. Identifies issuer and brand; used for routing."],
          ["CNP", "Card Not Present — transaction without physical card (e.g. e-commerce). Higher fraud risk."],
          ["CSU", "Card Status Update — data block used in ARPC Method 2. Lets the issuer update card status on the chip."],
          ["CVV / CVC", "Card Verification Value/Code — 3-digit code derived from PAN, expiry and issuer key. CVV1 on track data, CVV2 printed on back."],
          ["DDA", "Dynamic Data Authentication — offline auth where the chip signs dynamic data. Safer than SDA."],
          ["EMV", "Europay, Mastercard, Visa — global chip transaction standard."],
          ["IAD", "Issuer Application Data — issuer-proprietary data in Bit 55 (tag 9F10). Contains the cryptogram profile (CVN)."],
          ["IMK", "Issuer Master Key — issuer root key. Used to derive the ICC MK. Never leaves the HSM in production."],
          ["LLLVAR", "Variable field with 3-digit length prefix. E.g. '012HELLO WORLD!' (012 = length)."],
          ["LLVAR", "Variable field with 2-digit length prefix. E.g. '12HELLO WORLD!' (12 = length)."],
          ["MTI", "Message Type Indicator — 4 digits identifying the ISO 8583 message type. E.g. 0200 = Financial Request."],
          ["NII", "Network Interface Identifier — 2-byte identifier assigned by the brand. Used in TPDU for routing."],
          ["PAN", "Primary Account Number — card number. Bit 2. Usually 13-19 digits."],
          ["PIN Block", "Encrypted block containing the PIN. Bit 52. 8 bytes in ISO 9564 format."],
          ["PSN", "PAN Sequence Number — card sequence number. Disambiguates multiple cards with the same PAN. Used in ICC MK derivation."],
          ["RC", "Response Code — 2 chars in bit 39 indicating result. '00' = approved, '05' = declined."],
          ["RRN", "Retrieval Reference Number — unique transaction reference. Bit 37. 12 chars. Used for tracking and reversal."],
          ["SDA", "Static Data Authentication — simpler offline auth. The chip signs static card data."],
          ["Session Key", "Key derived from ICC MK + ATC. Unique per transaction. Used to compute the ARQC."],
          ["STAN", "System Trace Audit Number — sequential number. Bit 11. 6 digits. Unique per terminal per day."],
          ["TLV", "Tag-Length-Value — encoding structure used in Bit 55. Each field has Tag, Length and Value."],
          ["TPDU", "Transport Protocol Data Unit — 5-byte prefix before the MTI on TCP. ID + origin NII + destination NII."],
          ["TVR", "Terminal Verification Results — 5 bytes (40 bits) in Bit 55 (tag 95). Each bit is the result of a terminal check."],
          ["UN", "Unpredictable Number — 4 random bytes generated by the terminal for ARQC calculation. Tag 9F37."],
          ["ZPK", "Zone PIN Key — PIN encryption key. Used to decrypt the received PIN Block."],
        ],
      },

      // ── ISO 20022 terms ─────────────────────────────────────────
      { type: "heading", level: 3, text: "ISO 20022 terms" },
      {
        type: "table",
        headers: ["Term", "Definition"],
        rows: [
          ["ACSC", "Accepted Settlement Completed — ISO 20022 status (pacs.002) meaning settlement completed. This is the ISO 20022 world's definitive \"approved\"."],
          ["AppHdr", "Business Application Header (head.001) — ISO 20022 routing envelope. Carries Fr/To, BizMsgIdr, MsgDefIdr, CreDt. Mandatory in CBPR+; optional in Pix."],
          ["BIC", "Business Identifier Code — 8- or 11-char SWIFT identifier (e.g. BRASBRRJXXX). Corporate name of the bank/institution on the network. In ISO 20022 it appears as BICFI inside FinInstnId."],
          ["camt", "Cash Management — ISO 20022 message family for reporting: statements (camt.053), notifications (camt.054), cancellations (camt.056) and queries."],
          ["Document", "Root element of an ISO 20022 message body. Its xmlns identifies type + version (e.g. urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13)."],
          ["head.001", "XSD for the Business Application Header (AppHdr). Envelope shared across every ISO 20022 family — mandatory in CBPR+ and other network contexts."],
          ["IBAN", "International Bank Account Number — up to 34-char international account number (starts with country code). Used in SEPA, CBPR+ and T2. In Brazil not mandatory for Pix (which uses DICT key or local bank data)."],
          ["MessageId / MsgId", "Unique identifier of an ISO 20022 message. Appears in the Document's GrpHdr and also in the AppHdr's BizMsgIdr. In Pix, BCB dictates the format (ISPB + date + sequence)."],
          ["MT ↔ MX", "MT is the legacy SWIFT message format (colon-delimited text blocks \"tag:value\"). MX is the ISO 20022 nickname (XML). CBPR+ is the program that maps MT→MX. ISOLeaf's MT↔MX Comparator produces that diff."],
          ["MTI → MX (equivalence)", "There is no direct mapping from MTI (ISO 8583) to MX (ISO 20022) — they are separate worlds. Conceptually a 0100 card authorization plays the same role as a pacs.008 credit transfer, but flows, participants and settlement are different."],
          ["pacs", "Payments Clearing and Settlement — ISO 20022 message family for interbank instructions. E.g. pacs.008 (credit), pacs.002 (status), pacs.004 (return), pacs.009 (FI-to-FI credit)."],
          ["pain", "Payment Initiation — ISO 20022 message family for customer↔bank initiation. E.g. pain.001 (credit order), pain.002 (status), pain.009/pain.012 (Pix Automático mandates)."],
          ["PDNG", "Pending — ISO 20022 status (pacs.002) meaning processing is still in flight; settlement will be notified later."],
          ["RJCT", "Rejected — ISO 20022 status (pacs.002) meaning the message was rejected. Comes with a StsRsn describing the refusal reason."],
          ["targetNamespace", "XSD attribute defining the namespace of the schema. It is the exact value that appears in the xmlns of the Document for the corresponding message."],
          ["UETR", "Unique End-to-end Transaction Reference — UUID v4 generated by the originating bank in CBPR+/SWIFT gpi. Follows the transaction across every hop and is the key of the gpi Tracker."],
          ["XSD", "XML Schema Definition — file defining structure, types and rules of an ISO 20022 XML. Every message has a versioned XSD; ISOLeaf's Validator compares a message against the XSD to surface errors."],
        ],
      },
    ],
  },

  community: {
    id: "community",
    blocks: [
      {
        type: "paragraph",
        text:
          "Your feedback is essential for ISOLeaf to grow. Use the channels below to report bugs, suggest features or get in touch.",
      },
      {
        type: "list",
        items: [
          "💬 [GitHub Discussions](https://github.com/isoleaf-io/isoleaf/discussions) — questions, ideas and feedback",
          "🐛 [GitHub Issues](https://github.com/isoleaf-io/isoleaf/issues) — bug reports and feature requests",
          "📧 [contato@isoleaf.dev](mailto:contato@isoleaf.dev) — partnerships and enterprise inquiries",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "When reporting bugs, please avoid including sensitive data in screenshots and messages (real PAN, real ARQC, keys). Use masked examples like the ones shown in the guides.",
      },
    ],
  },

  apiDocs: {
    id: "apiDocs",
    blocks: [
      // ── Section 1: Intro ──────────────────────────────────────────────
      { type: "heading", level: 2, text: "REST API" },
      {
        type: "paragraph",
        text:
          "ISOLeaf exposes a REST API covering ISO 8583, EMV cryptography and the full ISO 20022 block (Pix, SEPA, CBPR+, TARGET/T2, MT ↔ MX). It is intended for **self-hosted (Docker) mode only** — ideal for plumbing automated test tools, generating synthetic data for homologation pipelines and inspecting captured production traces.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Full interactive documentation (every endpoint, schema, \"Try it out\" panel) lives at [http://localhost:8080/api/docs](http://localhost:8080/api/docs) — powered by Scalar. Start the local Agent first: `docker run -p 8080:8080 ghcr.io/isoleaf-io/isoleaf:latest`.",
      },
      { type: "divider" },

      // ── Section 2: Recommended APIs ───────────────────────────────────
      { type: "heading", level: 2, text: "Recommended endpoints" },
      {
        type: "paragraph",
        text:
          "Ten endpoints — five per protocol — cover the bulk of integration scenarios, synthetic-data generation and test automation. The remaining ones are mostly UI plumbing. Every code block below uses exactly the same synthetic values that Scalar's \"Try it out\" panel pre-fills.",
      },

      { type: "heading", level: 3, text: "ISO 8583 / EMV" },

      // 1. Parse hex
      { type: "heading", level: 4, text: "POST /api/parse/hex" },
      { type: "paragraph", text: "**When to use:** automating parse of production traces, validating messages in integration tests, extracting specific bits from ISO logs." },
      {
        type: "list",
        items: [
          "`hexMessage` — string · the ISO 8583 message bytes; auto-detects ASCII-on-the-wire or binary-hex",
          "`layoutName` — string · optional, defaults to \"default\" (1987 field set)",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/parse/hex \\
  -H "Content-Type: application/json" \\
  -d '{
    "hexMessage": "0100722000000080000016411111111111111100000000000100001000000111223344556677",
    "layoutName": "default"
  }'`,
      },
      { type: "paragraph", text: "**Returns:** the decoded `mti`, `messageClass`, `activeBits` and `fields[]` (each with `bitNumber`, `name`, `value`, `displayValue` and `length`). Partial parses surface as `success=false` with a structured `parseError` — never 5xx." },

      // 2. Parse Bit 55
      { type: "heading", level: 4, text: "POST /api/emv/parse-bit55" },
      { type: "paragraph", text: "**When to use:** inspecting EMV data from captured chip transactions, validating Bit 55 contents in chip tests, debugging TLV tags." },
      {
        type: "list",
        items: [
          "`hexBit55` — string · BER-TLV hex bytes (e.g. `9F2608…9F1008…`)",
          "`headerBytes` — number · bytes of proprietary header to skip before the TLV (default 0)",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/emv/parse-bit55 \\
  -H "Content-Type: application/json" \\
  -d '{
    "hexBit55": "9F26081122334455667788999F27018F9F10080706010A03A4B0C09F37046A5B4C3D9F3602001E9F1A0200769505000000000",
    "headerBytes": 0
  }'`,
      },
      { type: "paragraph", text: "**Returns:** `tags[]` (each with `tag`, `name`, `length`, `value`) plus convenience fields (`arqc`, `atc`, `cryptogramType`, `authResponseCode`). Partial parses surface every tag read up to the failure byte plus `parseError`." },

      // 3. Generate card
      { type: "heading", level: 4, text: "POST /api/cards/generate" },
      { type: "paragraph", text: "**When to use:** generating mass test data for homologation, creating Luhn-valid synthetic cards with full Track 1/2, CVV and identity payload." },
      {
        type: "list",
        items: [
          "`brand` — string · \"Visa\", \"Mastercard\", \"Amex\", \"Elo\", \"Hipercard\", \"DinersClub\", \"Discover\" or \"JCB\"",
          "`cardholderName` — optional · defaults to a random Brazilian name",
          "`expiry` — optional · YYMM (e.g. \"2912\"), defaults to ~3 years out",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/cards/generate \\
  -H "Content-Type: application/json" \\
  -d '{"brand": "Visa"}'`,
      },
      { type: "paragraph", text: "**Returns:** `pan`, `panMasked`, `cardholderName`, `expiry`, `expiryFormatted`, `serviceCode`, `cvv`, `cvv2`, `track1`, `track2`, `brand` and `generatedAt`. Test data only — never feed real cardholder data." },

      // 4. Generate ARQC
      { type: "heading", level: 4, text: "POST /api/emv/generate-arqc" },
      { type: "paragraph", text: "**When to use:** simulating the chip cryptogram in EMV authorization tests, validating the ARQC flow without a physical card in hand." },
      {
        type: "list",
        items: [
          "`pan`, `panSequenceNumber`, `atc` — card identity + transaction counter",
          "`amountAuthorized`, `amountOther`, `transactionDate`, `transactionType` — Bits 9F02 / 9F03 / 9A / 9C",
          "`terminalCountryCode`, `tvr`, `currencyCode`, `unpredictableNumber`, `aip`, `iad` — terminal + transaction data",
          "`issuerMasterKey` — 32 hex chars · the test IMK published in the integration suite",
          "`profile` — \"Visa\", \"Mastercard\" or \"Elo\"",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/emv/generate-arqc \\
  -H "Content-Type: application/json" \\
  -d '{
    "issuerMasterKey": "0123456789ABCDEF0123456789ABCDEF",
    "pan": "4111111111111111",
    "panSequenceNumber": "00",
    "atc": "001E",
    "amountAuthorized": "000000001000",
    "amountOther": "000000000000",
    "terminalCountryCode": "0076",
    "tvr": "0000000000",
    "currencyCode": "0986",
    "transactionDate": "250615",
    "transactionType": "00",
    "unpredictableNumber": "AABBCCDD",
    "aip": "1800",
    "iad": "0706010A03A40000",
    "profile": "Visa"
  }'`,
      },
      { type: "paragraph", text: "**Returns:** the 8-byte `arqc` (16 hex chars) plus the derived `sessionKey`, `iccMasterKey` and `transactionData` MAC input for traceability. Same algorithm used by the EMV → Generate ARQC tab." },

      // 5. Generate ARPC
      { type: "heading", level: 4, text: "POST /api/emv/generate-arpc" },
      { type: "paragraph", text: "**When to use:** simulating the issuer reply in EMV authorization tests, validating the ARPC computation in issuer-host development." },
      {
        type: "list",
        items: [
          "`arqc` — the ARQC the chip emitted (16 hex chars)",
          "`issuerMasterKey`, `pan`, `panSequenceNumber`, `atc` — same derivation context as `generate-arqc`",
          "`authResponseCode` — 4 hex chars representing the 2-char ASCII RC (e.g. \"3030\" = \"00\" approved)",
          "`profile` — \"Visa\", \"Mastercard\" or \"Elo\"",
          "`method` — \"Method1\" (Visa / Elo) or \"Method2\" (Mastercard, requires `csu`)",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/emv/generate-arpc \\
  -H "Content-Type: application/json" \\
  -d '{
    "arqc": "112233445566778899AABBCCDDEE",
    "issuerMasterKey": "0123456789ABCDEF0123456789ABCDEF",
    "pan": "4111111111111111",
    "panSequenceNumber": "00",
    "atc": "001E",
    "authResponseCode": "3030",
    "csu": null,
    "profile": "Visa",
    "method": "Method1"
  }'`,
      },
      { type: "paragraph", text: "**Returns:** the 8-byte `arpc` plus the `sessionKey` used to compute it. Mastercard's Method 2 also surfaces the `csu` echo in the response." },

      { type: "heading", level: 3, text: "ISO 20022" },

      // 6. Builder — generate ISO 20022 message
      { type: "heading", level: 4, text: "POST /api/iso20022/builder/build" },
      { type: "paragraph", text: "**When to use:** producing ISO 20022 mass data for test pipelines (Pix, SEPA, CBPR+, TARGET/T2), populating homologation environments with structurally valid messages, or fetching a skeleton for any catalogue scenario to edit programmatically." },
      {
        type: "list",
        items: [
          "`messageType` — string · full type with version (e.g. `pacs.008.001.13`)",
          "`scenarioId` — string · scenario id from the `ScenarioRegistry` (e.g. `pix-credit-transfer`, `pix-return`, `cbpr-direct-payment`, `sepa-initiation`, `t2-credit-transfer`)",
          "`includeOptionalXPaths` — array of strings · XPaths of optional fields to emit on top of the mandatory ones (defaults to empty)",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/iso20022/builder/build \\
  -H "Content-Type: application/json" \\
  -d '{
    "messageType": "pacs.008.001.13",
    "scenarioId": "pix-credit-transfer",
    "includeOptionalXPaths": []
  }'`,
      },
      { type: "paragraph", text: "**Returns:** `messageType`, `scenarioId`, `xml` (rendered Document with the scenario's overrides applied) and `sections[]` (section/field tree with metadata driving the editor: mandatoriness, default values, enumerations, min/max length, regex pattern). Same endpoint the Builder UI consumes." },

      // 7. Test data — person
      { type: "heading", level: 4, text: "GET /api/test-data/person" },
      { type: "paragraph", text: "**When to use:** populating test forms with coherent synthetic identity (name, CPF, e-mail, Pix-phone) instead of hard-coded values, generating load scenarios with distinct identities, keeping logs free of real cardholder data." },
      {
        type: "list",
        items: [
          "`locale` — optional query param · `pt_BR` (default), `de`, `en` — routes the backend Faker generator. `pt_BR` yields CPF + Brazilian +55 phone; `de`/`en` yield local equivalents.",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl "http://localhost:8080/api/test-data/person?locale=pt_BR"`,
      },
      { type: "paragraph", text: "**Returns:** `name`, `cpf`, `email`, `phone` — all structurally valid (CPF passes the check-digit, phone in E.164 form) and fully synthetic. Never cache — each call yields a fresh identity." },

      // 8. Validate ISO 20022 XML
      { type: "heading", level: 4, text: "POST /api/iso20022/validate" },
      { type: "paragraph", text: "**When to use:** validating in CI/CD that a generated message stays XSD-compliant after a refactor, catching structural errors before shipping to SPI/CBPR+, batch-checking a captured message set." },
      {
        type: "list",
        items: [
          "`xmlContent` — string · full Document XML (with or without AppHdr)",
          "`messageType` — optional string · when omitted, the validator auto-detects the type from the root `xmlns`; useful to force validation against a specific version",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/iso20022/validate \\
  -H "Content-Type: application/json" \\
  -d '{
    "xmlContent": "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?><Document xmlns=\\"urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13\\"><FIToFICstmrCdtTrf><GrpHdr><MsgId>PIX20260710BANCO0001</MsgId><CreDtTm>2026-07-10T14:30:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf></GrpHdr></FIToFICstmrCdtTrf></Document>",
    "messageType": null
  }'`,
      },
      { type: "paragraph", text: "**Returns:** `messageType`, `isValid` (bool), `errorCount`, `warningCount` and `errors[]` — each error carries `message` (raw .NET validator text), `severity` (`error`/`warning`), `lineNumber`, `linePosition` and the `xpath` of the offending element resolved via `XmlLineMapper` (so the UI can anchor the error to the parsed tree)." },

      // 9. SWIFT MT parse
      { type: "heading", level: 4, text: "POST /api/swift/mt/parse" },
      { type: "paragraph", text: "**When to use:** parsing SWIFT MTs captured in the legacy environment before/during CBPR+ migration, feeding an MT-vs-MX reconciliation pipeline, decoding synthetic test blocks in integration suites." },
      {
        type: "list",
        items: [
          "`rawMessage` — string · full MT with the `{1:...}{2:...}{3:...}{4:...}` blocks in classic SWIFT format. Accepts MT103, MT202 and MT202COV.",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/swift/mt/parse \\
  -H "Content-Type: application/json" \\
  -d '{
    "rawMessage": "{1:F01BANKBRSPAXXX0000000000}{2:I103BANKUS33XXXXN}{4:\\n:20:REF2262XYZ\\n:23B:CRED\\n:32A:260710USD1234,56\\n:50K:/12345678901\\nMARIA SILVA\\n:59:/9876543210\\nJOHN DOE\\n:71A:SHA\\n-}"
  }'`,
      },
      { type: "paragraph", text: "**Returns:** `messageType` (`MT103`/`MT202`/`MT202COV`), `fields` (block 4 decoded by tag — `:20:` senderReference, `:32A:` value date/currency/amount, `:50K:`/`:59:` ordering/beneficiary, etc.), `senderBic`/`receiverBic` extracted from blocks 1/2, and `warnings[]` for non-fatal format deviations. Types outside MT103/MT202/MT202COV return 422." },

      // 10. Pix QR Code generate
      { type: "heading", level: 4, text: "POST /api/pix/qrcode/generate" },
      { type: "paragraph", text: "**When to use:** generating synthetic Pix QR codes for checkout tests, producing batches of Copia-e-Cola payloads for POS/e-commerce screens in homologation, spitting out CRC-16-valid QRs for decoder regression suites." },
      {
        type: "list",
        items: [
          "`pixKey` — string · Pix key (accepts EVP, e-mail, phone, CPF or CNPJ)",
          "`merchantName` — string · recipient name (ASCII upper preferred, EMV-MPM caps at 25 chars)",
          "`merchantCity` — string · city (ASCII upper, ≤15 chars — the helper `GET /api/test-data/city` already returns a compliant one)",
          "`amount` — optional decimal · value in BRL (e.g. `10` or `12.34`); omit to generate a value-less QR",
          "`txId` — optional string · up to 25 alphanumeric chars; defaults to `***` (static QR without TXID)",
          "`description` — optional string · free-form text shown in the payer's app",
          "`singleUse` — bool · `true` flips POI Method to 12 (dynamic single-use QR); default `false` (static)",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/pix/qrcode/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "pixKey": "teste@isoleaf.dev",
    "merchantName": "ISOLEAF TESTE",
    "merchantCity": "SAO PAULO",
    "amount": 10,
    "txId": "ISOLEAF2026071000000001TX",
    "description": "Pagamento demo",
    "singleUse": false
  }'`,
      },
      { type: "paragraph", text: "**Returns:** `payload` — the complete EMV-MPM string (Pix Copia-e-Cola) with CRC-16 computed at the end. Ready to feed a QR renderer or to drop straight into a Copia-e-Cola field on the payer's app." },

      { type: "divider" },

      // ── Section 3: Full reference link ────────────────────────────────
      { type: "heading", level: 2, text: "Full documentation" },
      {
        type: "paragraph",
        text:
          "48 endpoints across 17 controllers in total. The 10 documented here are just the didactic tip — for the full list (Flow Visualizer, Version Comparator, schema upload, Simulator TCP session management, Health, Config, etc.) open the interactive Scalar UI:",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "➜ [Open Scalar API Docs](http://localhost:8080/api/docs) — available only in self-hosted mode (Docker / local agent, default port 8080). If you changed the Agent's port, tweak the URL by hand.",
      },
    ],
  },
};
