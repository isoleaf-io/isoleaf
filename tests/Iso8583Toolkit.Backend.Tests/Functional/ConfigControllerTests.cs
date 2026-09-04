using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Iso8583Toolkit.Backend.Tests.Functional;

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
        return new BackendWebAppFactory().WithWebHostBuilder(builder =>
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
        body.GetProperty("schemaUploadEnabled").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Config_Standalone_ExposesSchemaUploadEnabledTrue()
    {
        // Companion to Config_Standalone_ReturnsAllEnabled — checks the
        // schemaUploadEnabled flag was actually added to the wire, not
        // just to the record. Backend and frontend read the same JSON
        // shape, so a missing property here would silently fall back to
        // the frontend DEFAULT_CONFIG (also true) and mask the bug.
        await using var factory = FactoryWithMode(null);
        using var client = factory.CreateClient();
        var resp = await client.GetAsync("/api/config");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("schemaUploadEnabled").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task SchemaUpload_Online_Returns403WithCatalogueHint()
    {
        // The XSD upload path (POST /api/workspace/schemas/upload) is gated
        // in online mode, with a hint that names the fixed catalogue
        // constraint — separate from the generic simulator/EMV hint so the
        // UI can surface a targeted banner on the Workspace screen.
        await using var factory = FactoryWithMode("online");
        using var client = factory.CreateClient();
        // Empty multipart is fine — the 403 fires in middleware before the
        // controller ever binds the IFormFile.
        using var form = new MultipartFormDataContent();
        var resp = await client.PostAsync("/api/workspace/schemas/upload", form);
        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("error").GetString().Should().Contain("online");
        body.GetProperty("hint").GetString().Should().Contain("fixed");
        body.GetProperty("docker").GetString().Should().Contain("ghcr.io/isoleaf-io/isoleaf");
    }

    [Fact]
    public async Task SchemaList_Online_IsNotBlocked()
    {
        // Companion to SchemaUpload_Online_Returns403WithCatalogueHint —
        // the read path GET /api/workspace/schemas MUST stay open in
        // online mode so the Reference and Version Comparator screens
        // keep working over the fixed 44-XSD catalogue. Middleware uses
        // the specific "/upload" suffix precisely to avoid catching the
        // list route by prefix.
        await using var factory = FactoryWithMode("online");
        using var client = factory.CreateClient();
        var resp = await client.GetAsync("/api/workspace/schemas");
        resp.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
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

    // ── AgentUrlHint (Sprint 12.2 P5+) ─────────────────────────────────

    private static WebApplicationFactory<Program> FactoryWithConfig(
        Dictionary<string, string?> values)
    {
        return new BackendWebAppFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(c =>
            {
                c.AddInMemoryCollection(values);
            });
        });
    }

    [Fact]
    public async Task Config_AgentUrlHint_IsNullWhenEnvVarUnset()
    {
        // Default deployment — no AGENT_URL_HINT configured. The property
        // must be null (or absent) so the frontend leaves the Workspace
        // input empty and the user types the URL themselves.
        await using var factory = FactoryWithMode(null);
        using var client = factory.CreateClient();
        var resp = await client.GetAsync("/api/config");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        if (body.TryGetProperty("agentUrlHint", out var hint))
        {
            // Property is emitted but null — either shape is acceptable.
            hint.ValueKind.Should().Be(JsonValueKind.Null);
        }
    }

    [Fact]
    public async Task Config_AgentUrlHint_IsPassedThroughWhenEnvVarSet()
    {
        await using var factory = FactoryWithConfig(new Dictionary<string, string?>
        {
            ["AGENT_URL_HINT"] = "http://sim.internal:8583",
        });
        using var client = factory.CreateClient();
        var resp = await client.GetAsync("/api/config");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("agentUrlHint").GetString()
            .Should().Be("http://sim.internal:8583");
    }

    [Fact]
    public async Task Config_AgentUrlHint_TrimsWhitespaceAndTreatsBlankAsNull()
    {
        // Blank string is the same as unset — never surface " " as a hint;
        // the frontend would render it as-is in a text field.
        await using var factory = FactoryWithConfig(new Dictionary<string, string?>
        {
            ["AGENT_URL_HINT"] = "   ",
        });
        using var client = factory.CreateClient();
        var resp = await client.GetAsync("/api/config");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        if (body.TryGetProperty("agentUrlHint", out var hint))
        {
            hint.ValueKind.Should().Be(JsonValueKind.Null);
        }
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
