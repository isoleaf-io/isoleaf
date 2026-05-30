using System.Text.Json.Serialization;
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
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();
app.MapHub<SimulatorHub>("/hubs/simulator");

// SPA fallback for client-side routing — but NOT for /api or /hubs paths.
// (Liveness/readiness is served by HealthController at GET /api/health.)
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program { }
