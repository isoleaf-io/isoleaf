using System.Text.Json.Serialization;
using Microsoft.Extensions.FileProviders;
using Iso8583Toolkit.Agent.Hubs;
using Iso8583Toolkit.Agent.Services;
using Iso8583Toolkit.Api.Services;
using Iso8583Toolkit.Cards;
using Iso8583Toolkit.Cryptography.Emv;
using Iso8583Toolkit.IsoCore.Building.Smart;
using Iso8583Toolkit.IsoCore.Validation;

var builder = WebApplication.CreateBuilder(args);

// ── Configuration ──────────────────────────────────────────────────────
// Honour explicit ASPNETCORE_URLS / launchSettings; otherwise fall back to Agent:Port.
// Skip the override under WebApplicationFactory (Test env) so the in-memory TestServer takes over.
if (!builder.Environment.IsEnvironment("Test") &&
    string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    var port = builder.Configuration.GetValue<int?>("Agent:Port") ?? 8080;
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// ── Services ───────────────────────────────────────────────────────────
builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase, allowIntegerValues: true));
    })
    .ConfigureApplicationPartManager(apm =>
    {
        // Only expose Agent's controllers — referenced API project's controllers are excluded.
        var foreign = apm.ApplicationParts
            .Where(p => p.Name != typeof(Program).Assembly.GetName().Name)
            .ToList();
        foreach (var p in foreign) apm.ApplicationParts.Remove(p);
    });

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(
        "http://localhost:8080", "http://127.0.0.1:8080",
        "http://localhost:5173", "http://127.0.0.1:5173", // Vite dev server
        "http://localhost:3000", "http://127.0.0.1:3000")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

builder.Services.AddSignalR()
    .AddJsonProtocol(o =>
    {
        o.PayloadSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase, allowIntegerValues: true));
    });

// API services (re-used as building blocks)
builder.Services.AddSingleton<IsoParseService>();
builder.Services.AddSingleton<IsoBuildService>();
builder.Services.AddSingleton<IsoMessageValidator>();
builder.Services.AddSingleton<ICardDataProvider, CardDataProvider>();
builder.Services.AddSingleton<SmartIsoBuilder>();

// Domain services
builder.Services.AddSingleton<CardGenerator>();
builder.Services.AddSingleton<EmvCryptoService>();

// Agent-specific
builder.Services.AddSingleton<LocalSessionStore>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    return new LocalSessionStore
    {
        LogRetention = config.GetValue<int?>("Agent:LogRetentionMessages") ?? 500
    };
});
builder.Services.AddSingleton<TcpSessionManager>();

var app = builder.Build();

// ── Pipeline ───────────────────────────────────────────────────────────
app.UseCors();
// Serve physical files from wwwroot: the React SPA assets (/assets/*, /favicon.svg,
// /logo*.svg) and the static landing page assets (/landing/assets/*).
// NOTE: no UseDefaultFiles() — "/" must NOT auto-resolve to the React index.html.
// The "/" and "/app" routes are mapped explicitly below.
app.UseStaticFiles();

// Resolve the web root once (falls back when WebRootPath is unset, e.g. tests).
var webRoot = app.Environment.WebRootPath
              ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
var contentRoot = app.Environment.ContentRootPath;

// HTML entry points live in wwwroot after a Docker/Release build, but in local
// dev (`dotnet run` without copying the frontend) they only exist in the source
// tree. Each page therefore resolves across an ordered list of candidates:
//   1. wwwroot/...                       (production / Docker)
//   2. ../../frontend/...  (repo source) (dev local)
// Resolution is per-request so a frontend (re)build is picked up without
// restarting the host; a clear 404 is returned when no candidate exists.
string[] landingCandidates =
{
    Path.Combine(webRoot, "landing", "index.html"),                                 // prod / Docker
    Path.Combine(contentRoot, "..", "..", "frontend", "landing", "index.html"),     // dev local
};
string[] spaCandidates =
{
    Path.Combine(webRoot, "index.html"),                                            // prod / Docker (vite outDir)
    Path.Combine(contentRoot, "..", "..", "frontend", "isohub", "dist", "index.html"), // dev local (vite build)
};

static IResult ServePage(string label, string[] candidates)
{
    var resolved = candidates.Select(Path.GetFullPath).ToArray();
    var file = resolved.FirstOrDefault(File.Exists);
    return file is not null
        ? Results.File(file, "text/html; charset=utf-8")
        : Results.Problem(
            title: $"{label} not found",
            detail: "Looked in: " + string.Join(" | ", resolved),
            statusCode: StatusCodes.Status404NotFound);
}

// Dev local only: the landing's assets (/landing/assets/*) are copied into
// wwwroot only by the Docker build, so serve them straight from the source tree
// when wwwroot/landing is absent. No-op in production / Docker.
var devLandingDir = Path.GetFullPath(Path.Combine(contentRoot, "..", "..", "frontend", "landing"));
if (!Directory.Exists(Path.Combine(webRoot, "landing")) && Directory.Exists(devLandingDir))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(devLandingDir),
        RequestPath = "/landing",
    });
}

// ── ISOHUB_MODE=online: block crypto/simulator routes ─────────────────
// The same image powers both local (full features) and public demo (read-only,
// no crypto, no TCP listeners). Mode is resolved through IConfiguration so
// it picks up env vars in prod AND in-memory overrides from tests — without
// the process-global state that breaks xUnit parallel collections.
var configuredMode = app.Configuration["ISOHUB_MODE"]?.Trim().ToLowerInvariant();
if (configuredMode == "online")
{
    app.Use(async (context, next) =>
    {
        var path = context.Request.Path.Value ?? string.Empty;
        // Block only the EMV endpoints that need IMK / cryptographic material.
        // /api/emv/parse-bit55 and /api/emv/build-response-bit55 are pure
        // BER-TLV assembly/disassembly — no key surface — so they stay open
        // to match the EMV page's UI classification (requiresCrypto = false).
        var blocked =
            path.StartsWith("/api/simulator", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/emv/validate", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/emv/generate", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/emv/full-flow", StringComparison.OrdinalIgnoreCase);

        if (blocked)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "This feature is not available in the online version.",
                hint = "Install ISOLeaf locally via Docker to use this feature.",
                docker = "docker run -p 8080:8080 ghcr.io/isoleaf-io/isoleaf:latest"
            });
            return;
        }
        await next(context);
    });
}

app.MapControllers();
app.MapHub<SimulatorHub>("/hubs/simulator");

// ── Page routing ───────────────────────────────────────────────────────
//   GET /            → static landing page (wwwroot/landing/index.html)
//   GET /app         → React SPA shell  (wwwroot/index.html)
//   GET /app/{**}    → React SPA shell  (so client-side routing deep links work)
//   /api/* , /hubs/* → handled above by controllers / SignalR
app.MapGet("/", () => ServePage("Landing page", landingCandidates));
app.MapGet("/app", () => ServePage("App shell", spaCandidates));
app.MapGet("/app/{**path}", () => ServePage("App shell", spaCandidates));

app.Run();

public partial class Program { }
