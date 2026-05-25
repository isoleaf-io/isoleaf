namespace Iso8583Toolkit.IsoCore.Domain;

/// <summary>
/// Parsed representation of a 5-byte TPDU (Transport Protocol Data Unit) header:
/// [ID (1 byte)] [Destination NII (2 bytes BCD)] [Source NII (2 bytes BCD)].
/// </summary>
public sealed record TpduInfo(string Hex, byte Id, string DestinationNii, string SourceNii);
