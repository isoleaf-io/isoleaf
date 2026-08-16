namespace Iso8583Toolkit.Application.DTOs;

public sealed record IsoBuildRequest(
    string Mti,
    List<FieldInput> Fields,
    string LayoutName = "default");
