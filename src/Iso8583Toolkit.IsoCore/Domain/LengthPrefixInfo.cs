namespace Iso8583Toolkit.IsoCore.Domain;

/// <summary>
/// Optional 2-byte big-endian length prefix detected immediately after the
/// (optional) TPDU in a parsed ISO 8583 message. Common in TCP framing where
/// each message body is prefixed with its byte length.
///
/// We only set this when the declared length matches the remaining payload —
/// when <see cref="Match"/> is <c>true</c> the parser strips the prefix
/// before continuing; when <c>false</c> the bytes are left in place (and the
/// parser will likely fail on them) so the discrepancy stays visible to the
/// caller.
/// </summary>
/// <param name="Hex">The 2 prefix bytes in upper-case hex, e.g. "02E2".</param>
/// <param name="ExpectedLength">The uint16 value of those 2 bytes.</param>
/// <param name="ActualLength">Byte length of the payload that follows.</param>
/// <param name="Match">True iff <see cref="ExpectedLength"/> == <see cref="ActualLength"/>.</param>
public sealed record LengthPrefixInfo(string Hex, int ExpectedLength, int ActualLength, bool Match);
