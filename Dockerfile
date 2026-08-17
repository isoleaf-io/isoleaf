# syntax=docker/dockerfile:1.6
# ─────────────────────────────────────────────────────────────────────────────
# ISOLeaf v3.0 — split image build. The Sprint 12.2 split moved the
# Simulator (TCP sessions + SignalR + /api/simulator/*) into a second .NET
# process (agent/Iso8583Toolkit.Agent) that runs independently of the SPA
# host (agent/Iso8583Toolkit.Backend). Each process ships as its own image.
#
# Stage layout:
#   1. frontend-build   — npm ci + vite build → agent/Iso8583Toolkit.Backend/wwwroot
#   2. dotnet-build     — dotnet publish (Backend) AND (Agent), two output dirs
#   3. runtime-backend  — SPA host + utility APIs, port 8080, ships wwwroot + schemas
#   4. runtime-agent    — Simulator host, port 8583, no SPA, no schemas
#
# No default target — every build must specify one:
#   docker build --target runtime-backend -t ghcr.io/isoleaf-io/isoleaf-backend:latest .
#   docker build --target runtime-agent   -t ghcr.io/isoleaf-io/isoleaf-agent:latest   .
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Frontend build ─────────────────────────────────────────────────
# vite.config.ts sets outDir to ../../agent/Iso8583Toolkit.Backend/wwwroot
# (a path relative to frontend/isohub/), so we mirror the real repo layout
# instead of fighting the config.
FROM node:20-alpine AS frontend-build
WORKDIR /src
RUN mkdir -p agent/Iso8583Toolkit.Backend/wwwroot

WORKDIR /src/frontend/isohub
# Install deps first — cached layer when package.json doesn't change.
COPY frontend/isohub/package*.json ./
RUN npm ci

# Copy sources and build. Output lands in /src/agent/Iso8583Toolkit.Backend/wwwroot
COPY frontend/isohub/ ./
RUN npm run build

# ── Stage 2: .NET build & publish (both projects) ───────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS dotnet-build
WORKDIR /src

# src/ carries the shared class libraries (IsoCore, Cards, Cryptography,
# Iso20022, Application, Simulator). agent/ carries BOTH host projects.
COPY src/ ./src/
COPY agent/ ./agent/

# Drop the freshly built SPA into Backend/wwwroot before publish (Agent
# doesn't serve a SPA — no equivalent step needed for it).
COPY --from=frontend-build /src/agent/Iso8583Toolkit.Backend/wwwroot/ ./agent/Iso8583Toolkit.Backend/wwwroot/

# Restore each host. Two calls (not `dotnet restore Iso8583Toolkit.sln`)
# so the layer cache invalidates independently — a change under
# agent/Iso8583Toolkit.Agent doesn't force a Backend restore.
RUN dotnet restore agent/Iso8583Toolkit.Backend/Iso8583Toolkit.Backend.csproj \
 && dotnet restore agent/Iso8583Toolkit.Agent/Iso8583Toolkit.Agent.csproj

# Publish Backend (framework-dependent — runtime images have the .NET
# runtime installed). SkipFrontend=true bypasses the csproj target that
# would otherwise invoke `npm install && npm run build` during Release —
# we already built the SPA in stage 1 and copied it straight into wwwroot.
# ErrorOnDuplicatePublishOutputFiles=false: Backend and referenced projects
# both ship appsettings.json. By default this is a hard error (NETSDK1152);
# we demote it — Backend's own files win in the published output.
RUN dotnet publish agent/Iso8583Toolkit.Backend/Iso8583Toolkit.Backend.csproj \
    -c Release -o /app/publish-backend --no-restore --self-contained false \
    -p:UseAppHost=false -p:SkipFrontend=true -p:ErrorOnDuplicatePublishOutputFiles=false

# Publish Agent (minimal Web API, no SPA / schemas — its output is much smaller).
RUN dotnet publish agent/Iso8583Toolkit.Agent/Iso8583Toolkit.Agent.csproj \
    -c Release -o /app/publish-agent --no-restore --self-contained false \
    -p:UseAppHost=false

# ── Stage 3: Runtime — BACKEND (SPA + utility APIs, port 8080) ──────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime-backend
WORKDIR /app

# wget is needed for the HEALTHCHECK (not present in the slim aspnet image).
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget \
 && rm -rf /var/lib/apt/lists/*

# Non-root user — fixed uid/gid for predictable volume permissions.
RUN groupadd --system --gid 1001 isoleaf \
 && useradd --system --uid 1001 --gid 1001 --home /app --shell /sbin/nologin isoleaf

COPY --from=dotnet-build --chown=isoleaf:isoleaf /app/publish-backend ./
# Sprint 9.5 — ISO 20022 schemas live outside the assembly. The XSDs
# shipped in this image seed /app/data/schemas so a fresh container can
# validate against every default variant. Mounting a volume at this
# path preserves any user-uploaded XSD across container recreations:
#
#     docker run -v isoleaf-schemas:/app/data/schemas ...
#
# Docker auto-populates an *empty* named volume with the image's
# content on the first run — the defaults land inside the volume, and
# subsequent uploads via POST /api/workspace/schemas/upload persist
# alongside them.
COPY --from=dotnet-build --chown=isoleaf:isoleaf /app/publish-backend/Schemas /app/data/schemas
RUN mkdir -p /app/data && chown -R isoleaf:isoleaf /app/data

USER isoleaf

EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    ISOHUB_DATA_PATH=/app/data \
    ISOHUB_SCHEMAS_PATH=/app/data/schemas

# Container-level liveness — hits the /api/health endpoint on the Backend.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 -O /dev/null http://localhost:8080/api/health || exit 1

ENTRYPOINT ["dotnet", "Iso8583Toolkit.Backend.dll"]

# ── Stage 4: Runtime — AGENT (Simulator + SignalR + TCP, port 8583) ─────────
# Deliberately minimal: no wwwroot (no SPA to serve), no Schemas (Agent
# doesn't validate ISO 20022 XML), no /app/data volume (Simulator sessions
# and message log are in-memory by design in v3). Same base + same non-root
# user for consistency with runtime-backend.
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime-agent
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends wget \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 isoleaf \
 && useradd --system --uid 1001 --gid 1001 --home /app --shell /sbin/nologin isoleaf

COPY --from=dotnet-build --chown=isoleaf:isoleaf /app/publish-agent ./

USER isoleaf

# 8583 = the Agent's HTTP + SignalR port. Simulator TCP listeners are
# opened dynamically by the user via /api/simulator/sessions and land on
# whatever port they choose in the UI (9100 is the default in the new
# Sessão form). Those ports need to be mapped at `docker run -p` /
# compose `ports:` time — the image itself only pre-declares 8583.
EXPOSE 8583

ENV ASPNETCORE_URLS=http://+:8583 \
    ASPNETCORE_ENVIRONMENT=Production

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 -O /dev/null http://localhost:8583/api/health || exit 1

ENTRYPOINT ["dotnet", "Iso8583Toolkit.Agent.dll"]
