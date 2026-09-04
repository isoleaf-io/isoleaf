using System.Text.Json;
using System.Text.Json.Serialization;
using Iso8583Toolkit.Simulator.Logging;
using Iso8583Toolkit.Simulator.Sessions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Iso8583Toolkit.Agent.Tests;

/// <summary>
/// In-memory test server for the Simulator Agent host. A fresh
/// <see cref="InMemorySessionStore"/> + <see cref="InMemoryMessageLog"/>
/// are injected per factory so tests never share state.
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
            var existingSessions = services.SingleOrDefault(d => d.ServiceType == typeof(ISessionStore));
            if (existingSessions is not null) services.Remove(existingSessions);
            services.AddSingleton<ISessionStore, InMemorySessionStore>();

            var existingLog = services.SingleOrDefault(d => d.ServiceType == typeof(IMessageLog));
            if (existingLog is not null) services.Remove(existingLog);
            services.AddSingleton<IMessageLog, InMemoryMessageLog>();
        });
    }
}
