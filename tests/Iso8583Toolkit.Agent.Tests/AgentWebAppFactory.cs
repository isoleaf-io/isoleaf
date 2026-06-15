using System.Text.Json;
using System.Text.Json.Serialization;
using Iso8583Toolkit.Agent.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Iso8583Toolkit.Agent.Tests;

/// <summary>
/// In-memory test server for the Agent. No real ports opened; a fresh
/// <see cref="LocalSessionStore"/> is injected so tests stay isolated.
/// </summary>
public sealed class AgentWebAppFactory : WebApplicationFactory<Program>
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
