using System.ComponentModel;
using System.Reflection;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi.Models;
using Iso8583Toolkit.Agent.Hubs;
using Iso8583Toolkit.Agent.OpenApi;
using Iso8583Toolkit.Agent.Services;
using Iso8583Toolkit.Api.Services;
using Iso8583Toolkit.Cards;
using Iso8583Toolkit.Cryptography.Emv;
using Iso8583Toolkit.Iso20022.Builder;
using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Services.Summary;
using Iso8583Toolkit.Iso20022.Validation;
using Iso8583Toolkit.IsoCore.Building.Smart;
using Iso8583Toolkit.IsoCore.Validation;
using Scalar.AspNetCore;

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

// ISO 20022 — SchemaRegistry is heavy (reads 32 embedded XSDs once); ParserService,
// ValidatorService, SummaryService and the VersionCompareService are stateless
// after construction, so everything stays singleton. ReferenceService runs
// XsdFieldExtractor over every XSD at startup and caches the result.
builder.Services.AddSingleton<SchemaRegistry>();
builder.Services.AddSingleton<SummaryService>();
builder.Services.AddSingleton<Iso20022ParserService>();
builder.Services.AddSingleton<Iso20022ValidatorService>();
builder.Services.AddSingleton<ReferenceService>();
builder.Services.AddSingleton<VersionCompareService>();
builder.Services.AddSingleton<ReturnGeneratorService>();
// Builder side (6.4): scenario catalogue + the renderer it drives.
// Sprint 8.1 — PaymentTestDataGenerator must be registered BEFORE
// ScenarioRegistry so DI can inject it into the registry's constructor.
builder.Services.AddSingleton<Iso8583Toolkit.Iso20022.TestData.PaymentTestDataGenerator>();
builder.Services.AddSingleton<XmlExampleGenerator>();
builder.Services.AddSingleton<ScenarioRegistry>();
builder.Services.AddSingleton<BuilderService>();
// Sprint 7 — Pix QR Code (EMV-MPM) decode/generate + key/TXID helpers.
builder.Services.AddSingleton<Iso8583Toolkit.Iso20022.Pix.PixQrCodeService>();
// Sprint 7.3 — Pix Flow Visualizer (multi-message orchestrator).
builder.Services.AddSingleton<Iso8583Toolkit.Iso20022.Pix.Flow.PixFlowService>();

// ── OpenAPI ────────────────────────────────────────────────────────────
// Single document ("v1") covers the whole API surface. Every action is
// annotated inline with [EndpointSummary] / [EndpointDescription] for the
// Scalar UI to render — only the five "headline" endpoints carry pre-filled
// request bodies, the rest are documented in prose but expose empty examples
// so users have to type their own (intentional: avoids implying that the
// internal endpoints are part of the public contract).
builder.Services.AddOpenApi("v1", options =>
{
    options.AddDocumentTransformer((doc, _, _) =>
    {
        doc.Info = new OpenApiInfo
        {
            Title = "ISOLeaf API",
            Version = "v1",
            Description = """
                REST API for ISO 8583 message processing, EMV data handling
                and test card generation.

                > ⚠️ This API is intended for **local/self-hosted use only**.
                > Do not send real cardholder data or production keys to
                > external servers.

                Run locally with Docker:
                ```
                docker run -p 8080:8080 ghcr.io/isoleaf-io/isoleaf:latest
                ```
                """,
            Contact = new OpenApiContact { Email = "contato@isoleaf.dev" }
        };
        return Task.CompletedTask;
    });

    // Copy [Description] attributes from DTO properties into the OpenAPI
    // schema so every documented request/response field surfaces its hint.
    options.AddSchemaTransformer((schema, ctx, _) =>
    {
        var type = ctx.JsonTypeInfo.Type;
        foreach (var prop in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            var desc = prop.GetCustomAttribute<DescriptionAttribute>()?.Description;
            if (string.IsNullOrWhiteSpace(desc)) continue;
            var camel = char.ToLowerInvariant(prop.Name[0]) + prop.Name[1..];
            if (schema.Properties.TryGetValue(camel, out var sub)) sub.Description = desc;
            else if (schema.Properties.TryGetValue(prop.Name, out sub)) sub.Description = desc;
        }
        return Task.CompletedTask;
    });

    // Inject "Try it out" request-body examples for the five headline
    // endpoints only — internal actions are documented in prose but kept
    // example-less on purpose.
    options.AddOperationTransformer((op, ctx, _) =>
    {
        var key = $"{ctx.Description.HttpMethod}:/{ctx.Description.RelativePath}";
        if (OpenApiExamples.RequestBody.TryGetValue(key, out var example) &&
            op.RequestBody?.Content.TryGetValue("application/json", out var media) == true)
        {
            media.Example = example;
        }
        return Task.CompletedTask;
    });
});

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

// Response caching for static-shaped endpoints (the ISO 20022 reference
// catalogue, in particular — its data is derived from embedded XSDs and
// doesn't change at runtime, so the response is safe to cache aggressively).
builder.Services.AddResponseCaching();

var app = builder.Build();

// Warm-up of heavy singletons. The ReferenceService eagerly walks 32 XSDs
// in its constructor (~1.5s cold); without this, the cost lands on the first
// HTTP hit to /api/iso20022/reference/* — exactly the moment a user is
// staring at a loading spinner in production. Resolving here moves the cost
// to container boot, where there's nobody waiting.
_ = app.Services.GetRequiredService<SchemaRegistry>();
_ = app.Services.GetRequiredService<ReferenceService>();

// ── Pipeline ───────────────────────────────────────────────────────────
app.UseCors();
app.UseResponseCaching();
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

// ── OpenAPI document + Scalar UI ───────────────────────────────────────
// /openapi/v1.json is always available (machine-readable, no risk in online
// mode). The Scalar UI is gated to standalone — running the agent online
// implies the user accepts the curated documentation lives elsewhere.
app.MapOpenApi();
if (configuredMode != "online")
{
    app.MapScalarApiReference("/api/docs", options =>
    {
        options.WithTitle("ISOLeaf API");
    });
    // Convenience redirect so users don't have to remember the document
    // segment that Scalar appends. Excluded from the OpenAPI description
    // so it doesn't show up in the Scalar sidebar as an "endpoint".
    app.MapGet("/api/docs", () => Results.Redirect("/api/docs/v1"))
       .ExcludeFromDescription();
}

// ── Page routing ───────────────────────────────────────────────────────
//   GET /            → static landing page (wwwroot/landing/index.html)
//   GET /app         → React SPA shell  (wwwroot/index.html)
//   GET /app/{**}    → React SPA shell  (so client-side routing deep links work)
//   /api/* , /hubs/* → handled above by controllers / SignalR
app.MapGet("/", () => ServePage("Landing page", landingCandidates));
app.MapGet("/app", () => ServePage("App shell", spaCandidates));
app.MapGet("/app/{**path}", () => ServePage("App shell", spaCandidates));


app.MapFallback(context =>
{
    var path = context.Request.Path.Value ?? string.Empty;

    // Deixa passar: API, hubs, arquivos estáticos, openapi
    if (path.StartsWith("/api", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/hubs", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/openapi", StringComparison.OrdinalIgnoreCase) ||
        path.Contains('.')) // arquivos estáticos (ex: .js, .css, .svg)
    {
        context.Response.StatusCode = 404;
        return Task.CompletedTask;
    }

    // Tudo mais → SPA shell
    var result = ServePage("App shell", spaCandidates);
    return result.ExecuteAsync(context);
});

// ── SEO: sitemap.xml + robots.txt (served from the landing folder) ───────
app.MapGet("/sitemap.xml", () =>
{
    var candidates = new[]
    {
        Path.Combine(webRoot, "landing", "sitemap.xml"),
        Path.GetFullPath(Path.Combine(contentRoot, "..", "..", "frontend", "landing", "sitemap.xml")),
    };
    var file = candidates.Select(Path.GetFullPath).FirstOrDefault(File.Exists);
    return file is not null
        ? Results.File(file, "application/xml; charset=utf-8")
        : Results.NotFound();
});

app.MapGet("/robots.txt", () =>
{
    var candidates = new[]
    {
        Path.Combine(webRoot, "landing", "robots.txt"),
        Path.GetFullPath(Path.Combine(contentRoot, "..", "..", "frontend", "landing", "robots.txt")),
    };
    var file = candidates.Select(Path.GetFullPath).FirstOrDefault(File.Exists);
    return file is not null
        ? Results.File(file, "text/plain; charset=utf-8")
        : Results.NotFound();
});

app.Run();

public partial class Program { }
