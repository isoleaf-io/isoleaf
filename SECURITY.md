# Security Policy

## Privacy and Data Collection

ISOLeaf is a **local-first** tool. All processing happens
on your machine — no data is ever sent to external servers.

You can verify this yourself:

```bash
# Check for outbound HTTP calls in the source code
grep -r "fetch\|axios\|XMLHttpRequest\|HttpClient" src/ \
  --include="*.cs" --include="*.ts" --include="*.tsx" \
  | grep -v "test\|spec\|mock\|localhost\|127.0.0.1\|/api/"
```

The only network calls in ISOLeaf are:
- Browser → `localhost:8080` (your local Agent)
- TCP connections opened by the **Simulator** (you configure the hosts)

## Official Distribution

Always use the official image from GitHub Container Registry:

```bash
docker pull ghcr.io/isoleaf-io/isoleaf:latest
```

Verify the image digest matches the official release:
```bash
docker inspect ghcr.io/isoleaf-io/isoleaf:latest \
  --format='{{index .RepoDigests 0}}'
```

Compare with the digest published in the
[GitHub Releases](https://github.com/isoleaf-io/isoleaf/releases) page.

> ⚠️ **Warning about forks**: This repository is open source
> and can be forked by anyone. A malicious fork could add
> data collection or backdoors. Always verify you are using
> the official image from `ghcr.io/isoleaf-io/isoleaf` and
> the official repository at `github.com/isoleaf-io/isoleaf`.

## Reporting a Vulnerability

If you discover a security vulnerability in ISOLeaf,
please report it responsibly:

**Do NOT open a public GitHub Issue for security vulnerabilities.**

Instead, use one of these private channels:

- 📧 **Email**: contato@isoleaf.dev
  Include "SECURITY" in the subject line.

- 🔒 **GitHub Security Advisories**:
  [Report a vulnerability](https://github.com/isoleaf-io/isoleaf/security/advisories/new)

We will acknowledge your report within 48 hours and aim
to release a fix within 14 days for critical issues.

## Scope

The following are **in scope** for security reports:
- Data exfiltration or unexpected outbound network calls
- Remote code execution via the Agent API
- Authentication bypass (if authentication is added in future)
- Parser vulnerabilities that could crash or exploit the system
- Docker image integrity issues

The following are **out of scope**:
- Vulnerabilities in the Simulator TCP connections
  (by design, these open ports you configure)
- Issues in development dependencies (vitest, vite, etc.)
  that only affect local development environments
- Social engineering attacks

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅ Yes    |
| < 1.0.0 | ❌ No     |

We recommend always using the latest version.

## Acknowledgements

We thank the security community for helping keep
ISOLeaf safe for everyone.
