using System.Buffers.Binary;

namespace Iso8583Toolkit.Simulator.Framing;

/// <summary>
/// Default ISO 8583 wire framer: 2-byte big-endian length prefix (the
/// convention every card network uses) followed by the payload. Header
/// size can be adjusted per session:
///   - 2 (default) — standard length-prefixed framing.
///   - 4 — same idea, wider prefix.
///   - 0 — un-framed "1 connect = 1 message" mode used by POS terminals
///         with proprietary transports; the reader drains the stream
///         until the remote half-closes and the writer just dumps the
///         bytes verbatim.
///
/// Behaviour is identical to the legacy MessageFramer class that used to
/// live in the Agent's Services folder — this port just relocates the
/// implementation under the Simulator library and exposes it via
/// <see cref="IMessageFramer"/> so callers can swap alternate wire
/// contracts (delimited, HTTP/gRPC, tests with an in-memory framer).
/// </summary>
public sealed class LengthPrefixMessageFramer : IMessageFramer
{
    private readonly int _headerSize;

    public LengthPrefixMessageFramer(int headerSize = 2)
    {
        if (headerSize is not (0 or 2 or 4))
            throw new ArgumentException(
                "Header size must be 0 (no framing), 2 or 4 bytes.", nameof(headerSize));
        _headerSize = headerSize;
    }

    public async Task<byte[]?> ReadMessageAsync(Stream stream, CancellationToken ct = default)
    {
        if (_headerSize == 0)
        {
            // Un-framed: drain the connection until close. CopyToAsync returns
            // when the remote half-closes (or the cancellation token fires).
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, ct);
            var bytes = ms.ToArray();
            return bytes.Length == 0 ? null : bytes;
        }

        var header = new byte[_headerSize];
        var bytesRead = await ReadExactAsync(stream, header, ct);
        if (bytesRead < _headerSize)
            return null; // Connection closed

        var length = _headerSize == 2
            ? BinaryPrimitives.ReadUInt16BigEndian(header)
            : (int)BinaryPrimitives.ReadUInt32BigEndian(header);

        if (length == 0 || length > 65535)
            return null;

        var payload = new byte[length];
        bytesRead = await ReadExactAsync(stream, payload, ct);
        if (bytesRead < length)
            return null;

        return payload;
    }

    public async Task WriteMessageAsync(Stream stream, byte[] message, CancellationToken ct = default)
    {
        if (_headerSize == 0)
        {
            await stream.WriteAsync(message, ct);
            await stream.FlushAsync(ct);
            return;
        }

        var header = new byte[_headerSize];
        if (_headerSize == 2)
            BinaryPrimitives.WriteUInt16BigEndian(header, (ushort)message.Length);
        else
            BinaryPrimitives.WriteUInt32BigEndian(header, (uint)message.Length);

        await stream.WriteAsync(header, ct);
        await stream.WriteAsync(message, ct);
        await stream.FlushAsync(ct);
    }

    private static async Task<int> ReadExactAsync(Stream stream, byte[] buffer, CancellationToken ct)
    {
        var totalRead = 0;
        while (totalRead < buffer.Length)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(totalRead), ct);
            if (read == 0)
                return totalRead; // Connection closed
            totalRead += read;
        }
        return totalRead;
    }
}
