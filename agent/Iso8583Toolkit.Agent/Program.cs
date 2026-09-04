using System.Text.Json.Serialization;
using Iso8583Toolkit.Agent.Hubs;
using Iso8583Toolkit.Agent.Services;
using Iso8583Toolkit.Simulator.Logging;
using Iso8583Toolkit.Simulator.Sessions;

var builder = WebApplication.CreateBuilder(args);

// ── Configuration ──────────────────────────────────────────────────────
// The Agent lives on a separate port from the Backend so both can run
// side-by-side during dev / local Docker Compose. Skip the URL override
// under WebApplicationFactory so the in-memory TestServer takes over.
if (!builder.Environment.IsEnvironment("Test") &&
    string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    var port = builder.Configuration.GetValue<int?>("Agent:Port") ?? 8583;
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// ── Services ───────────────────────────────────────────────────────────
builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase, allowIntegerValues: true));
    });

// CORS: the SPA (served by the Backend) hits the Agent's REST + SignalR
// endpoints cross-origin, and the Backend's URL is not knowable in advance
// — every operator configures a different one via the Workspace UI
// (Sprint 12.2 P5+; the URL is user-configured localStorage state, not a
// fixed deployment topology). Since a WithOrigins allow-list can't cover
// an arbitrary user-picked origin, we open the policy to any origin.
//
// Safe because this host only runs standalone / on the operator's own
// machine or trusted network — it never faces the public internet
// (that's the Backend's job, and the Backend blocks /api/simulator/*
// under ISOHUB_MODE=online). SetIsOriginAllowed(_ => true) is needed
// instead of AllowAnyOrigin because AllowCredentials + AllowAnyOrigin
// is rejected by ASP.NET Core CORS as a spec violation (Access-Control
// -Allow-Origin cannot be "*" when credentials flow).
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .SetIsOriginAllowed(_ => true)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

builder.Services.AddSignalR()
    .AddJsonProtocol(o =>
    {
        o.PayloadSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase, allowIntegerValues: true));
    });

// ── Simulator DI ───────────────────────────────────────────────────────
// The three Sprint 12.2 ports, each backed by its default in-memory adapter.
// A future hosted-mode Agent (Redis/SQL/Elastic) would only need to swap
// these registrations.
builder.Services.AddSingleton<ISessionStore, InMemorySessionStore>();
builder.Services.AddSingleton<IMessageLog>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    return new InMemoryMessageLog
    {
        LogRetention = config.GetValue<int?>("Agent:LogRetentionMessages") ?? 500
    };
});
builder.Services.AddSingleton<TcpSessionManager>();

var app = builder.Build();

app.UseCors();
app.MapControllers();
app.MapHub<SimulatorHub>("/hubs/simulator");

app.Run();

public partial class Program { }
