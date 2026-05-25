namespace Iso8583Toolkit.IsoCore.Building.Smart;

/// <summary>
/// ISO 8583 transaction capture channel — drives POS Entry Mode (bit 22)
/// and determines which fields are required.
/// </summary>
public enum TransactionChannel
{
    /// <summary>POS Entry Mode 010 — manual key entry.</summary>
    Presencial,

    /// <summary>POS Entry Mode 021 — magnetic stripe read.</summary>
    Tarja,

    /// <summary>POS Entry Mode 051 — ICC chip (contact).</summary>
    Chip,

    /// <summary>POS Entry Mode 071 — contactless chip (NFC/CTLS).</summary>
    Contactless,

    /// <summary>POS Entry Mode 010 — card not present (e-commerce, MOTO).</summary>
    CNP,

    /// <summary>POS Entry Mode 801 — chip fallback to magnetic stripe.</summary>
    Fallback
}
