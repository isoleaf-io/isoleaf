namespace Iso8583Toolkit.Simulator.Protocol;

public sealed class ResponseRules
{
    /// <summary>
    /// Maps request MTI to response MTI. E.g.: "0200" → "0210"
    /// </summary>
    public Dictionary<string, string> MtiResponseMap { get; init; } = new()
    {
        ["0100"] = "0110",
        ["0200"] = "0210",
        ["0400"] = "0410",
        ["0420"] = "0430",
        ["0800"] = "0810"
    };

    /// <summary>
    /// Field overrides applied to every response. E.g.: bit 39 → "00" (always approve).
    /// </summary>
    public Dictionary<int, string> FieldOverrides { get; init; } = new();

    /// <summary>
    /// Conditional rules evaluated in order. First match wins.
    /// </summary>
    public List<ConditionalRule> ConditionalRules { get; init; } = [];
}
