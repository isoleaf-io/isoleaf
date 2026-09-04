using System.Text.Json;
using System.Text.Json.Serialization;
using Iso8583Toolkit.Backend.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Iso8583Toolkit.Backend.Tests;

/// <summary>
/// In-memory test server for the Backend host. A fresh
/// <see cref="LocalSessionStore"/> is injected per factory so tests
/// stay isolated. The Simulator host (SimulatorController + SignalR)
/// runs in a separate process/project since Sprint 12.2 P4 — its
/// tests use <c>AgentWebAppFactory</c> in <c>Iso8583Toolkit.Agent.Tests</c>.
/// </summary>
public sealed class BackendWebAppFactory : WebApplicationFactory<Program>
{
    public static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: true) }
    };

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Test");

        builder.ConfigureServices(services =>
        {
            // Replace the singleton store with a fresh one per factory.
            var existing = services.SingleOrDefault(d => d.ServiceType == typeof(LocalSessionStore));
            if (existing is not null) services.Remove(existing);
            services.AddSingleton(new LocalSessionStore());
        });
    }
}
