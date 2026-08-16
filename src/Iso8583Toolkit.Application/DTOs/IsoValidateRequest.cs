namespace Iso8583Toolkit.Application.DTOs;

public sealed record IsoValidateRequest(
    string HexMessage,
    string LayoutName = "default",
    List<int>? RequiredBits = null);
