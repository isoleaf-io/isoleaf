# syntax=docker/dockerfile:1.6
# ─────────────────────────────────────────────────────────────────────────────
# ISOHub — multi-stage build that produces a self-contained image with both
# the React SPA (built by Vite) and the .NET 9 Agent (which serves it).
#
# Stage layout:
#   1. frontend-build  — npm ci + vite build → ../../agent/.../wwwroot
#   2. dotnet-build    — dotnet restore + publish; SPA already in wwwroot
#   3. runtime         — aspnet:9.0 base, non-root user, healthcheck
#
# Build from repo root:  docker build -t isohub-io/isohub:latest .
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Frontend build ─────────────────────────────────────────────────
# vite.config.ts sets outDir to ../../agent/Iso8583Toolkit.Agent/wwwroot
# (a path relative to frontend/isohub/), so we mirror the real repo layout
# instead of fighting the config.
FROM node:20-alpine AS frontend-build
WORKDIR /src
RUN mkdir -p agent/Iso8583Toolkit.Agent/wwwroot

WORKDIR /src/frontend/isohub
# Install deps first — cached layer when package.json doesn't change.
COPY frontend/isohub/package*.json ./
RUN npm ci

# Copy sources and build. Output lands in /src/agent/Iso8583Toolkit.Agent/wwwroot
COPY frontend/isohub/ ./
RUN npm run build

# ── Stage 2: .NET build & publish ───────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS dotnet-build
WORKDIR /src

# Only the projects the Agent actually depends on. tests/ is excluded by
# .dockerignore (and would just bloat the image); the sln isn't needed since
# we restore via the Agent's csproj, which walks the ProjectReference graph
# into src/ transitively.
COPY src/ ./src/
COPY agent/ ./agent/

# Drop the freshly built SPA into the Agent's wwwroot before publish.
COPY --from=frontend-build /src/agent/Iso8583Toolkit.Agent/wwwroot/ ./agent/Iso8583Toolkit.Agent/wwwroot/

# Restore the Agent and everything it transitively references.
RUN dotnet restore agent/Iso8583Toolkit.Agent/Iso8583Toolkit.Agent.csproj

# Publish the Agent (framework-dependent — runtime image has the runtime).
# SkipFrontend=true bypasses the csproj target that would otherwise invoke
# `npm install && npm run build` in ../../frontend/isohub during Release — we
# already built the SPA in stage 1 and copied it straight into wwwroot.
# ErrorOnDuplicatePublishOutputFiles=false: Agent and the referenced Api project
# both ship appsettings.json / appsettings.Development.json. By default this is
# a hard error (NETSDK1152); we demote it — the Agent's own files win in the
# published output, which is the desired behaviour.
RUN dotnet publish agent/Iso8583Toolkit.Agent/Iso8583Toolkit.Agent.csproj -c Release -o /app/publish --no-restore --self-contained false -p:UseAppHost=false -p:SkipFrontend=true -p:ErrorOnDuplicatePublishOutputFiles=false

# ── Stage 3: Runtime ────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# wget is needed for the HEALTHCHECK (not present in the slim aspnet image).
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget \
 && rm -rf /var/lib/apt/lists/*

# Non-root user — fixed uid/gid for predictable volume permissions.
RUN groupadd --system --gid 1001 isohub \
 && useradd --system --uid 1001 --gid 1001 --home /app --shell /sbin/nologin isohub

# Copy published artifacts and prepare data dir for future workspace persistence.
COPY --from=dotnet-build --chown=isohub:isohub /app/publish ./
RUN mkdir -p /app/data && chown -R isohub:isohub /app/data

USER isohub

EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    ISOHUB_DATA_PATH=/app/data

# Container-level liveness — hits the /api/health endpoint added to Program.cs.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/api/health || exit 1

ENTRYPOINT ["dotnet", "Iso8583Toolkit.Agent.dll"]
