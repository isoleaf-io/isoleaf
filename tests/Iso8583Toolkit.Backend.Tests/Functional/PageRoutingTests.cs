using System.Net;
using System.Net.Http;
using FluentAssertions;
using Xunit;

namespace Iso8583Toolkit.Backend.Tests.Functional;

/// <summary>
/// The three page routes ("/", "/app", "/app/{**path}") must respond to both
/// GET and HEAD. Minimal routing in ASP.NET does not auto-pair HEAD with
/// MapGet — without the explicit MapMethods pair, HEAD requests fall through
/// to MapFallback (which serves the SPA shell for anything non-.api),
/// producing misleading responses for uptime probes and `curl -I`. Sprint
/// after 2.1.2 wired HEAD explicitly on all three; these tests pin that
/// down.
/// </summary>
public sealed class PageRoutingTests : IClassFixture<BackendWebAppFactory>
{
    // Custom handler that does NOT follow redirects — we need to observe
    // the 302 on "/" directly, not chase it into /app.
    private readonly HttpClient _client;

    public PageRoutingTests(BackendWebAppFactory factory) =>
        _client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });

    // ── / ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Root_Get_Returns302WithLocationApp()
    {
        var resp = await _client.GetAsync("/");
        resp.StatusCode.Should().Be(HttpStatusCode.Redirect);
        resp.Headers.Location!.ToString().Should().Be("/app");
    }

    [Fact]
    public async Task Root_Head_Returns302WithLocationApp()
    {
        // Head must match Get on the redirect route — same 302, same
        // Location header, empty body. Before HEAD was wired, this fell
        // through to MapFallback and returned 200 with the SPA shell.
        using var req = new HttpRequestMessage(HttpMethod.Head, "/");
        var resp = await _client.SendAsync(req);
        resp.StatusCode.Should().Be(HttpStatusCode.Redirect);
        resp.Headers.Location!.ToString().Should().Be("/app");
        var body = await resp.Content.ReadAsByteArrayAsync();
        body.Length.Should().Be(0, "HEAD responses carry no body");
    }

    // ── /app ────────────────────────────────────────────────────────────

    [Fact]
    public async Task App_Get_Returns200Html()
    {
        var resp = await _client.GetAsync("/app");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        resp.Content.Headers.ContentType!.MediaType.Should().Be("text/html");
    }

    [Fact]
    public async Task App_Head_Returns200SameHeadersAsGet_ButEmptyBody()
    {
        // GET first to capture the "reference" content-type/length the
        // route emits; then HEAD and assert we got the same status +
        // content-type + a zero-length body. HEAD MUST NOT be a 404 or
        // fall through to the fallback with the SPA shell.
        var getResp = await _client.GetAsync("/app");
        getResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var getContentType = getResp.Content.Headers.ContentType!.MediaType;

        using var req = new HttpRequestMessage(HttpMethod.Head, "/app");
        var headResp = await _client.SendAsync(req);
        headResp.StatusCode.Should().Be(HttpStatusCode.OK);
        headResp.Content.Headers.ContentType!.MediaType.Should().Be(getContentType);
        var body = await headResp.Content.ReadAsByteArrayAsync();
        body.Length.Should().Be(0, "HEAD responses carry no body");
    }

    // ── /app/{**path} ───────────────────────────────────────────────────

    [Fact]
    public async Task AppDeepLink_Head_Returns200_NotFallbackShell()
    {
        // Deep-link paths under /app must also accept HEAD — same SPA
        // shell, just no body. Uses a made-up path to prove the wildcard
        // {**path} accepts anything (React Router owns the resolution
        // client-side).
        using var req = new HttpRequestMessage(HttpMethod.Head, "/app/iso20022/parser");
        var resp = await _client.SendAsync(req);
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        resp.Content.Headers.ContentType!.MediaType.Should().Be("text/html");
    }
}
