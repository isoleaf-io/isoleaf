# syntax=docker/dockerfile:1.6
# ─────────────────────────────────────────────────────────────────────────────
# ISOLeaf — multi-stage build that produces a self-contained image with both
# the React SPA (built by Vite) and the .NET 9 Agent (which serves it).
#
# Stage layout:
#   1. frontend-build  — npm ci + vite build → ../../agent/.../wwwroot
#   2. dotnet-build    — dotnet restore + publish; SPA already in wwwroot
#   3. runtime         — aspnet:9.0 base, non-root user, healthcheck
#
# Build from repo root:  docker build -t isoleaf-io/isoleaf:latest .
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

# Drop the static landing page alongside the SPA. It is served at "/" while the
# React app lives under "/app"; its assets are referenced as /landing/assets/*.
COPY frontend/landing/ /src/agent/Iso8583Toolkit.Agent/wwwroot/landing/

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
RUN groupadd --system --gid 1001 isoleaf \
 && useradd --system --uid 1001 --gid 1001 --home /app --shell /sbin/nologin isoleaf

# Copy published artifacts and prepare data dir for future workspace persistence.
COPY --from=dotnet-build --chown=isoleaf:isoleaf /app/publish ./
# Sprint 9.5 — ISO 20022 schemas live outside the assembly. The 44 XSDs
# shipped in this image seed /app/data/schemas so a fresh container can
# validate against every default variant. Mounting a volume at this
# path preserves any user-uploaded XSD across container recreations:
#
#     docker run -v isoleaf-schemas:/app/data/schemas ...
#
# Docker auto-populates an *empty* named volume with the image's
# content on the first run — the defaults land inside the volume, and
# subsequent uploads via POST /api/workspace/schemas/upload persist
# alongside them. Without the mount, uploads live only for the
# lifetime of the container instance (the seed set is still there).
COPY --from=dotnet-build --chown=isoleaf:isoleaf /app/publish/Schemas /app/data/schemas
RUN mkdir -p /app/data && chown -R isoleaf:isoleaf /app/data

USER isoleaf

EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    ISOHUB_DATA_PATH=/app/data \
    ISOHUB_SCHEMAS_PATH=/app/data/schemas

# Container-level liveness — hits the /api/health endpoint added to Program.cs.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 -O /dev/null http://localhost:8080/api/health || exit 1

ENTRYPOINT ["dotnet", "Iso8583Toolkit.Agent.dll"]
