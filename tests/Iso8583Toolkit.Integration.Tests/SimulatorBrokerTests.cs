using System.Net.WebSockets;
using FluentAssertions;
using Iso8583Toolkit.Simulator.Broker;
using Iso8583Toolkit.Simulator.Protocol;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace Iso8583Toolkit.Integration.Tests;

public sealed class SimulatorBrokerTests
{
    private readonly SimulatorBroker _broker = new(NullLogger<SimulatorBroker>.Instance);

    // ── IsAgentConnected ────────────────────────────────────────────────────

    [Fact]
    public void IsAgentConnected_NoAgent_ReturnsFalse()
    {
        _broker.IsAgentConnected("nonexistent").Should().BeFalse();
    }

    [Fact]
    public void GetConnectedAgents_Empty_ReturnsEmptyList()
    {
        _broker.GetConnectedAgents().Should().BeEmpty();
    }

    [Fact]
    public void GetAgent_NoAgent_ReturnsNull()
    {
        _broker.GetAgent("nonexistent").Should().BeNull();
    }

    // ── SendCommand without agent ───────────────────────────────────────────

    [Fact]
    public async Task SendCommand_NoAgent_ThrowsInvalidOperation()
    {
        var command = SimulatorMessage.Create(SimulatorMessageType.StartSession, "no-tenant");

        var act = () => _broker.SendCommand("no-tenant", command);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No agent connected*");
    }

    // ── BroadcastEvent ──────────────────────────────────────────────────────

    [Fact]
    public void BroadcastEvent_WithSubscriber_FiresEvent()
    {
        SimulatorMessage? received = null;
        _broker.OnBroadcast += (tenant, msg) => received = msg;

        var evt = SimulatorMessage.Create(SimulatorMessageType.MessageReceived, "test-tenant",
            new { hexMessage = "0200..." });

        _broker.BroadcastEvent("test-tenant", evt);

        received.Should().NotBeNull();
        received!.Type.Should().Be(SimulatorMessageType.MessageReceived);
    }

    [Fact]
    public void BroadcastEvent_NoSubscriber_DoesNotThrow()
    {
        var evt = SimulatorMessage.Create(SimulatorMessageType.MessageReceived, "test-tenant");
        var act = () => _broker.BroadcastEvent("test-tenant", evt);

        act.Should().NotThrow();
    }

    // ── SimulatorMessage serialization ───────────────────────────────────────

    [Fact]
    public void SimulatorMessage_SerializeDeserialize_RoundTrips()
    {
        var original = SimulatorMessage.Create(
            SimulatorMessageType.AgentRegister, "tenant-1",
            new AgentMetadata("1.0.0", "Windows", "DESKTOP-01", "192.168.1.100"));

        var bytes = original.Serialize();
        var deserialized = SimulatorMessage.Deserialize(bytes);

        deserialized.Should().NotBeNull();
        deserialized!.Type.Should().Be(SimulatorMessageType.AgentRegister);
        deserialized.TenantId.Should().Be("tenant-1");
        deserialized.Payload.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void SimulatorMessage_DeserializePayload_ReturnsTypedObject()
    {
        var metadata = new AgentMetadata("1.0.0", "Linux", "server-01", "10.0.0.5");
        var msg = SimulatorMessage.Create(SimulatorMessageType.AgentRegister, "t1", metadata);

        var restored = msg.DeserializePayload<AgentMetadata>();

        restored.Should().NotBeNull();
        restored!.Hostname.Should().Be("server-01");
        restored.OperatingSystem.Should().Be("Linux");
    }

    [Fact]
    public void SimulatorMessage_Create_HasUniqueId()
    {
        var msg1 = SimulatorMessage.Create(SimulatorMessageType.AgentHeartbeat, "t1");
        var msg2 = SimulatorMessage.Create(SimulatorMessageType.AgentHeartbeat, "t1");

        msg1.MessageId.Should().NotBe(msg2.MessageId);
    }

    [Fact]
    public void SimulatorMessage_Create_HasTimestamp()
    {
        var before = DateTime.UtcNow.AddSeconds(-1);
        var msg = SimulatorMessage.Create(SimulatorMessageType.AgentHeartbeat, "t1");
        var after = DateTime.UtcNow.AddSeconds(1);

        msg.Timestamp.Should().BeAfter(before).And.BeBefore(after);
    }

    // ── SessionConfig ───────────────────────────────────────────────────────

    [Fact]
    public void SessionConfig_Defaults_AreCorrect()
    {
        var config = new SessionConfig();

        config.TcpPort.Should().Be(8583);
        config.Mode.Should().Be(SimulatorMode.Rebatedor);
        config.LayoutName.Should().Be("default");
        config.DefaultResponseCode.Should().Be("00");
        config.AutoRespond.Should().BeTrue();
        config.TimeoutMs.Should().Be(30000);
        config.SessionId.Should().NotBeNullOrEmpty();
    }

    // ── ResponseRules defaults ──────────────────────────────────────────────

    [Fact]
    public void ResponseRules_DefaultMtiMap_Contains0200to0210()
    {
        var rules = new ResponseRules();

        rules.MtiResponseMap.Should().ContainKey("0200");
        rules.MtiResponseMap["0200"].Should().Be("0210");
        rules.MtiResponseMap["0100"].Should().Be("0110");
        rules.MtiResponseMap["0800"].Should().Be("0810");
    }
}
