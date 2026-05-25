namespace Iso8583Toolkit.Api.DTOs;

public sealed record ParseHexRequest(
    string HexMessage,
    string LayoutName = "default");

public sealed record ParseAsciiRequest(
    string AsciiMessage,
    string LayoutName = "default");

public sealed record ParseBinaryHexRequest(
    string HexMessage,
    string LayoutName = "default");

public sealed record ParseBitmapRequest(
    string HexBitmap);
