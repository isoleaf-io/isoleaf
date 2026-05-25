namespace Iso8583Toolkit.IsoCore.Validation;

public sealed record ValidationError(
    string Code,
    string Field,
    string Message);
