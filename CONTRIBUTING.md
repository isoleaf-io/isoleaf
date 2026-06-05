# Contributing to ISOLeaf

Thank you for your interest in contributing to ISOLeaf! This document explains
how to contribute and what falls within the scope of the open-source core.

---

## What belongs in this repository

The ISOLeaf open-source core (`isoleaf-io/isoleaf`) includes:

| Module | Scope |
|--------|-------|
| **ISO 8583 Parser** | ASCII wire, binary-hex, TPDU auto-detection |
| **Smart Builder** | Contextual message generation by role/brand/channel |
| **Bitmap** | Decode and build bitmaps interactively |
| **EMV / Cryptography** | ARQC, ARPC, TLV parser, Full Flow |
| **TCP Simulator** | Rebatedor (listener) + Injector with continuous mode |
| **Test Card Generator** | PAN, tracks, CVV by brand |
| **Workspace** | Local key management (IMK, ZPK) |
| **Agent** | Standalone .NET 9 host serving the frontend |
| **Frontend** | React + TypeScript + Vite + Tailwind UI |

**What is NOT in scope here:**
- Authentication / multi-user identity
- Cloud workspace (shared templates, team features)
- Billing or subscription management
- ISOLeaf Platform (enterprise features)

---

## How to contribute

### Reporting bugs

Open a [GitHub Issue](https://github.com/isoleaf-io/isoleaf/issues) with:

- A clear title describing the problem
- Steps to reproduce
- Expected vs. actual behavior
- ISO message used (mask sensitive data — replace PAN digits with `*`)
- Environment: OS, .NET version, browser

### Suggesting features

Open a GitHub Issue with the label `enhancement`. Describe:

- The use case (what problem it solves)
- Proposed behavior
- Any ISO 8583 / EMV spec reference if applicable

### Submitting a Pull Request

1. **Fork** the repository and create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-description
   ```

2. **Make your changes** following the code style below

3. **Run the tests** before submitting:
   ```bash
   # Backend
   dotnet test

   # Frontend
   cd frontend/isohub
   npm run test
   npm run build
   ```

4. **All tests must pass** — PRs with failing tests will not be merged

5. **Open a Pull Request** against the `main` branch with:
   - A clear description of what changed and why
   - Reference to any related issue (`Closes #123`)

---

## Code style

### Backend (.NET / C#)
- Follow standard C# conventions
- Use `async/await` consistently
- Add XML doc comments to public APIs
- New endpoints must have corresponding integration tests

### Frontend (React / TypeScript)
- Functional components with hooks only
- All user-facing strings must use `t()` from i18next
- New UI features must have tests in `src/__tests__/`
- No `any` types — use proper TypeScript typing

### Tests
- Backend: xUnit, minimum coverage for new services
- Frontend: Vitest + Testing Library
- Do **not** use real PANs, real keys, or real transaction data in tests
  — generate synthetic values

---

## Branch naming

| Prefix | Use |
|--------|-----|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `refactor/` | Code improvements without behavior change |
| `test/` | Test additions or fixes |
| `release/` | Release preparation |

---

## Sensitive data

- **Never commit** real PANs, real cryptographic keys, or real transaction logs
- Use the synthetic data generators already in the project for tests
- If you find a security vulnerability, **do not open a public issue** —
  contact us at security@isoleaf.dev

---

## License

By contributing, you agree that your contributions will be licensed under the
same [Elastic License 2.0](./LICENSE) that covers this project.

---

## Questions?

Open a [GitHub Discussion](https://github.com/isoleaf-io/isoleaf/discussions)
or reach out via the community channels listed in the README.
