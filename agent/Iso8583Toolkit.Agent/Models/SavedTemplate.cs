namespace Iso8583Toolkit.Agent.Models;

public sealed record SavedTemplate
{
    public string TemplateId { get; init; } = Guid.NewGuid().ToString();
    public required string Name { get; init; }
    public string Description { get; init; } = "";
    public required string AsciiMessage { get; init; }
    public string BinaryHexMessage { get; init; } = "";
    public required string Mti { get; init; }
    public List<int> ActiveBits { get; init; } = [];
    public DateTime SavedAt { get; init; } = DateTime.UtcNow;
    public string? Tags { get; init; }
}
