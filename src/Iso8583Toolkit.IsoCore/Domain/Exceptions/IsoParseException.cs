namespace Iso8583Toolkit.IsoCore.Domain.Exceptions;

/// <summary>
/// Thrown when the ISO 8583 parser encounters a malformed or unexpected byte sequence.
/// </summary>
public sealed class IsoParseException : Exception
{
    /// <summary>
    /// The field context where the error occurred (e.g. "MTI", "Primary Bitmap", "Bit 35").
    /// </summary>
    public string Field { get; }

    /// <summary>
    /// Zero-based character position in the raw input string where the error was detected.
    /// </summary>
    public int Position { get; }

    /// <summary>
    /// The fragment of the raw input string that triggered the error (may be truncated).
    /// </summary>
    public string RawInput { get; }

    public IsoParseException(string field, int position, string rawInput, string message)
        : base(message)
    {
        Field = field;
        Position = position;
        RawInput = rawInput;
    }

    public IsoParseException(string field, int position, string rawInput, string message, Exception innerException)
        : base(message, innerException)
    {
        Field = field;
        Position = position;
        RawInput = rawInput;
    }

    /// <summary>
    /// Snapshot of the message as it had been built up to the point of failure —
    /// includes MTI, bitmaps, TPDU, length-prefix info and any fields that were
    /// already parsed successfully. <c>null</c> when the failure happened before
    /// the parser had anything to surface (e.g. invalid MTI). Set by the parser
    /// while unwinding so the API can return a partial result instead of just
    /// the error.
    /// </summary>
    public IsoMessage? PartialMessage { get; set; }
}
