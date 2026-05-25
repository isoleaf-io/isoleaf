namespace Iso8583Toolkit.IsoCore.Validation;

public sealed record ValidationWarning(
    string Code,
    string Field,
    string Message);
