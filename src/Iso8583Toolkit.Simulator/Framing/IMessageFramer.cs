namespace Iso8583Toolkit.Simulator.Framing;

/// <summary>
/// Reads and writes ISO 8583 messages over an arbitrary bidirectional
/// stream. The concrete framer decides how message boundaries are marked
/// on the wire (length prefix, delimiter, no framing, …); callers only
/// see complete payloads.
///
/// The Stream parameter is intentionally the .NET base type: framers are
/// transport-agnostic (NetworkStream, MemoryStream in tests, pipe streams
/// wrapped over gRPC/WebSocket in hypothetical future adapters).
/// </summary>
public interface IMessageFramer
{
    /// <summary>
    /// Reads one complete framed message from the stream. Returns null
    /// when the remote side closes the connection before a full message
    /// arrives — a normal end-of-stream, not an error.
    /// </summary>
    Task<byte[]?> ReadMessageAsync(Stream stream, CancellationToken ct = default);

    /// <summary>
    /// Writes one complete message to the stream, applying whatever
    /// framing this framer implements. Flushes before returning.
    /// </summary>
    Task WriteMessageAsync(Stream stream, byte[] message, CancellationToken ct = default);
}
