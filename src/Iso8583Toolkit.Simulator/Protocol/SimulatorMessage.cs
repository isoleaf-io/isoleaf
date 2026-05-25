using System.Text.Json;
using System.Text.Json.Serialization;

namespace Iso8583Toolkit.Simulator.Protocol;

public sealed record SimulatorMessage
{
    public string MessageId { get; init; } = Guid.NewGuid().ToString();
    public SimulatorMessageType Type { get; init; }
    public string TenantId { get; init; } = "";
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
    public string? Payload { get; init; }

    public T? DeserializePayload<T>() =>
        Payload is not null ? JsonSerializer.Deserialize<T>(Payload, JsonOptions) : default;

    public static SimulatorMessage Create(SimulatorMessageType type, string tenantId, object? payload = null) =>
        new()
        {
            Type = type,
            TenantId = tenantId,
            Payload = payload is not null ? JsonSerializer.Serialize(payload, JsonOptions) : null
        };

    public byte[] Serialize() => JsonSerializer.SerializeToUtf8Bytes(this, JsonOptions);

    public static SimulatorMessage? Deserialize(byte[] data) =>
        JsonSerializer.Deserialize<SimulatorMessage>(data, JsonOptions);

    public static SimulatorMessage? Deserialize(ReadOnlySpan<byte> data) =>
        JsonSerializer.Deserialize<SimulatorMessage>(data, JsonOptions);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: true) }
    };
}
