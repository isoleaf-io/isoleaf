using System.Buffers.Binary;
using System.Net.Sockets;

namespace Iso8583Toolkit.Agent.Services;

/// <summary>
/// Handles ISO 8583 message framing over TCP.
/// Default framing: 2-byte big-endian length prefix + message payload.
/// </summary>
public sealed class MessageFramer
{
    private readonly int _headerSize;

    public MessageFramer(int headerSize = 2)
    {
        if (headerSize is not (0 or 2 or 4))
            throw new ArgumentException(
                "Header size must be 0 (no framing), 2 or 4 bytes.", nameof(headerSize));
        _headerSize = headerSize;
    }

    /// <summary>
    /// Reads a framed message from the stream.
    /// <para>
    /// When <c>HeaderSize</c> is 2 or 4: reads the big-endian length prefix
    /// then exactly that many payload bytes.
    /// </para>
    /// <para>
    /// When <c>HeaderSize</c> is 0 (un-framed mode): reads all bytes until the
    /// remote side closes the connection. The caller is expected to discard the
    /// connection after a single message — matches the "1 connect = 1 message"
    /// convention used by POS terminals and legacy systems.
    /// </para>
    /// </summary>
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

    /// <summary>
    /// Writes a framed message to the stream. With <c>HeaderSize == 0</c> the
    /// payload is written verbatim with no length prefix (the caller is
    /// responsible for closing the connection so the peer's reader stops).
    /// </summary>
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
