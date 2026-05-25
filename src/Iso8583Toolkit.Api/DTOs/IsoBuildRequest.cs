namespace Iso8583Toolkit.Api.DTOs;

public sealed record IsoBuildRequest(
    string Mti,
    List<FieldInput> Fields,
    string LayoutName = "default");
