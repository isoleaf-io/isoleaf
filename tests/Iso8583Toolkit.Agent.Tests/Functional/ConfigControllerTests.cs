using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Iso8583Toolkit.Agent.Tests.Functional;

/// <summary>
/// Tests for the ISOHUB_MODE feature-flag plumbing — both the /api/config
/// endpoint and the middleware that blocks crypto/simulator routes when
/// running in online mode.
///
/// Mode is overridden via <see cref="IWebHostBuilder.ConfigureAppConfiguration"/>
/// (in-memory config) instead of process-wide env vars, so these tests do not
/// leak state into parallel xUnit collections.
/// </summary>
public class ConfigControllerTests
{
    private static WebApplicationFactory<Program> FactoryWithMode(string? mode)
    {
        return new AgentWebAppFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(c =>
            {
                c.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ISOHUB_MODE"] = mode,
                });
            });
        });
    }

    [Fact]
    public async Task Config_Standalone_ReturnsAllEnabled()
    {
        await using var factory = FactoryWithMode(null);
        using var client = factory.CreateClient();
        var resp = await client.GetAsync("/api/config");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("mode").GetString().Should().Be("standalone");
        body.GetProperty("simulatorEnabled").GetBoolean().Should().BeTrue();
        body.GetProperty("emvCryptoEnabled").GetBoolean().Should().BeTrue();
        body.GetProperty("workspaceKeysEnabled").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task Config_Online_ReturnsRestricted()
    {
        await using var factory = FactoryWithMode("online");
        using var client = factory.CreateClient();
        var resp = await client.GetAsync("/api/config");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("mode").GetString().Should().Be("online");
        body.GetProperty("simulatorEnabled").GetBoolean().Should().BeFalse();
        body.GetProperty("emvCryptoEnabled").GetBoolean().Should().BeFalse();
        body.GetProperty("workspaceKeysEnabled").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Simulator_Online_Returns403()
    {
        await using var factory = FactoryWithMode("online");
        using var client = factory.CreateClient();
        // Body shape doesn't matter — middleware short-circuits before model binding.
        var resp = await client.PostAsJsonAsync("/api/simulator/sessions", new { });
        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("error").GetString().Should().Contain("online");
    }

    [Fact]
    public async Task Emv_Online_ValidateArqc_Returns403()
    {
        await using var factory = FactoryWithMode("online");
        using var client = factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/emv/validate-arqc", new { });
        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("error").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("docker").GetString().Should().Contain("ghcr.io/isoleaf-io/isoleaf");
    }

    [Fact]
    public async Task Standalone_Simulator_NotBlocked()
    {
        // Sanity check that the middleware doesn't accidentally fire when mode != online.
        await using var factory = FactoryWithMode(null);
        using var client = factory.CreateClient();
        var resp = await client.GetAsync("/api/simulator/sessions");
        // The endpoint should respond on its own (200/404/etc.) — anything but 403.
        resp.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Emv_Online_BuildResponse_NotBlocked()
    {
        // Regression: an earlier version of the middleware blocked any path
        // starting with "/api/emv/build-response", which inadvertently caught
        // the real route "/api/emv/build-response-bit55" by prefix. Build
        // Response has no IMK / key surface, so it must stay available in
        // online mode — matching the EMV page's UI classification.
        await using var factory = FactoryWithMode("online");
        using var client = factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/emv/build-response-bit55", new { });
        resp.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }
}
