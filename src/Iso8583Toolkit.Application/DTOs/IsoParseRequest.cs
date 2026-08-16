using System.ComponentModel;

namespace Iso8583Toolkit.Application.DTOs;

public sealed record ParseHexRequest(
    [property: Description("Hex bytes of the ISO 8583 message — TPDU (optional) + MTI + bitmap + fields. Accepts either ASCII-on-the-wire hex or pure binary-hex; the parser auto-detects.")]
    string HexMessage,
    [property: Description("Named layout to parse against. \"default\" covers the standard ISO 8583:1987 8583 field definitions.")]
    string LayoutName = "default");

public sealed record ParseAsciiRequest(
    string AsciiMessage,
    string LayoutName = "default");

public sealed record ParseBinaryHexRequest(
    string HexMessage,
    string LayoutName = "default");

public sealed record ParseBitmapRequest(
    string HexBitmap);
