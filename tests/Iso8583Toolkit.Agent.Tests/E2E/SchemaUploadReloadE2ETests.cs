using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Iso8583Toolkit.Agent.Tests.E2E;

/// <summary>
/// Sprint 9.6 — end-to-end regression: uploading a new XSD via the
/// Workspace endpoint must make the new message type visible in the
/// reference/comparator endpoints within the same running process,
/// without any restart. Before the fix, ReferenceService kept a
/// snapshot from startup and completely ignored uploads.
///
/// Each test gets its own temp schemas directory injected through
/// <c>SchemaRegistry:SchemasPath</c> so the shipped catalogue on disk
/// isn't touched.
/// </summary>
public sealed class SchemaUploadReloadE2ETests : IDisposable
{
    private readonly string _tempDir;

    public SchemaUploadReloadE2ETests()
    {
        _tempDir = Path.Join(Path.GetTempPath(),
            "isoleaf-e2e-schema-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempDir);
    }

    public void Dispose()
    {
        try { Directory.Delete(_tempDir, recursive: true); } catch { /* best-effort */ }
    }

    [Fact]
    public async Task Upload_ThenReferenceEndpointListsNewMessageTypeImmediately()
    {
        // Seed a single XSD before the factory boots so the
        // ReferenceService's startup snapshot has a known baseline.
        WriteSchema("pacs.008.001.09", "FIToFICstmrCdtTrf");
        using var factory = MakeFactory();
        using var client = factory.CreateClient();

        // Baseline: only the seed schema is listed.
        var baseline = await client.GetFromJsonAsync<MessageTypeListResponse>(
            "/api/iso20022/reference",
            AgentWebAppFactory.JsonOpts);
        baseline!.MessageTypes.Should().ContainSingle().Which.Should().Be("pacs.008.001.09");

        // Upload a brand-new version through the same HTTP pipeline the
        // frontend uses.
        var uploaded = await UploadSchemaAsync(client, "pacs.008.001.05", "FIToFICstmrCdtTrfV05");
        uploaded.StatusCode.Should().Be(HttpStatusCode.OK);

        // Immediately re-hit the reference endpoint (same HttpClient,
        // same process) — the new version must show up.
        var afterUpload = await client.GetFromJsonAsync<MessageTypeListResponse>(
            "/api/iso20022/reference",
            AgentWebAppFactory.JsonOpts);
        afterUpload!.MessageTypes.Should().BeEquivalentTo(new[]
        {
            "pacs.008.001.05",
            "pacs.008.001.09",
        });
    }

    [Fact]
    public async Task Upload_ThenReferenceEndpointReturnsFieldsForNewMessageType()
    {
        WriteSchema("pacs.008.001.09", "FIToFICstmrCdtTrf");
        using var factory = MakeFactory();
        using var client = factory.CreateClient();

        (await UploadSchemaAsync(client, "pacs.008.001.05", "FIToFICstmrCdtTrfV05"))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        // The Reference screen's per-message endpoint must be able to
        // walk the field tree of the freshly-uploaded XSD.
        var detail = await client.GetAsync("/api/iso20022/reference/pacs.008.001.05");
        detail.StatusCode.Should().Be(HttpStatusCode.OK,
            "GetReference must serve fields for the new type — regression for Sprint 9.6");
    }

    [Fact]
    public async Task Upload_ThenComparatorEndpointCanDiffNewVersionAgainstExistingOne()
    {
        WriteSchema("pacs.008.001.09", "FIToFICstmrCdtTrf");
        using var factory = MakeFactory();
        using var client = factory.CreateClient();

        (await UploadSchemaAsync(client, "pacs.008.001.05", "FIToFICstmrCdtTrfV05"))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        // The Version Comparator screen hits this endpoint with the
        // two message types the user picked from the dropdown. Before
        // the fix it returned 404 ("Unknown message type") for the
        // freshly uploaded side.
        var response = await client.GetAsync(
            "/api/iso20022/reference/compare?from=pacs.008.001.05&to=pacs.008.001.09");

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            "the Version Comparator must accept a freshly-uploaded version — Sprint 9.6 regression");
    }

    // ── helpers ────────────────────────────────────────────────────────

    private WebApplicationFactory<Program> MakeFactory()
    {
        var tempDir = _tempDir;
        // WithWebHostBuilder returns a DelegatedWebApplicationFactory
        // wrapper — keep the base type in the signature so we don't
        // rely on the concrete AgentWebAppFactory class here.
        return new AgentWebAppFactory().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Test");
            builder.ConfigureAppConfiguration(cfg =>
            {
                // Route the SchemaRegistry singleton to the isolated
                // temp directory. Program.cs reads this key from
                // IConfiguration when constructing the registry.
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["SchemaRegistry:SchemasPath"] = tempDir,
                });
            });
        });
    }

    private static async Task<HttpResponseMessage> UploadSchemaAsync(
        HttpClient client, string messageType, string bodyName)
    {
        var xsd = MakePacs008ShapedXsd(
            "urn:iso:std:iso:20022:tech:xsd:" + messageType,
            bodyName);
        using var form = new MultipartFormDataContent();
        var bytes = new ByteArrayContent(Encoding.UTF8.GetBytes(xsd));
        bytes.Headers.ContentType = new MediaTypeHeaderValue("application/xml");
        form.Add(bytes, "file", messageType + ".xsd");
        return await client.PostAsync("/api/workspace/schemas/upload", form);
    }

    private void WriteSchema(string messageType, string bodyName)
    {
        var xsd = MakePacs008ShapedXsd(
            "urn:iso:std:iso:20022:tech:xsd:" + messageType, bodyName);
        File.WriteAllText(
            Path.Join(_tempDir, messageType + ".xsd"),
            xsd);
    }

    private static string MakePacs008ShapedXsd(string targetNamespace, string bodyName) => $$"""
        <?xml version="1.0" encoding="UTF-8"?>
        <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                   targetNamespace="{{targetNamespace}}"
                   xmlns="{{targetNamespace}}"
                   elementFormDefault="qualified">
          <xs:element name="Document">
            <xs:complexType>
              <xs:sequence>
                <xs:element name="{{bodyName}}" type="MessageBody"/>
              </xs:sequence>
            </xs:complexType>
          </xs:element>
          <xs:complexType name="MessageBody">
            <xs:sequence>
              <xs:element name="MsgId" type="xs:string" minOccurs="1"/>
              <xs:element name="CreDtTm" type="xs:string" minOccurs="1"/>
            </xs:sequence>
          </xs:complexType>
        </xs:schema>
        """;

    private sealed class MessageTypeListResponse
    {
        public string[] MessageTypes { get; set; } = [];
    }
}
