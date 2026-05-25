namespace Iso8583Toolkit.Simulator.Protocol;

public sealed record ConditionalRule(
    int BitNumber,
    string Operator,
    string Value,
    string ResponseCode,
    string? ResponseMti = null);
