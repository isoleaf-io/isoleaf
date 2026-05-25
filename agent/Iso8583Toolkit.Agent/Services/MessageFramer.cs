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
        if (headerSize is not (2 or 4))
            throw new ArgumentException("Header size must be 2 or 4 bytes.", nameof(headerSize));
        _headerSize = headerSize;
    }

    /// <summary>
    /// Reads a framed message from the stream: length header + payload.
    /// </summary>
    public async Task<byte[]?> ReadMessageAsync(NetworkStream stream, CancellationToken ct = default)
    {
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
    /// Writes a framed message to the stream: length header + payload.
    /// </summary>
    public async Task WriteMessageAsync(NetworkStream stream, byte[] message, CancellationToken ct = default)
    {
        var header = new byte[_headerSize];
        if (_headerSize == 2)
            BinaryPrimitives.WriteUInt16BigEndian(header, (ushort)message.Length);
        else
            BinaryPrimitives.WriteUInt32BigEndian(header, (uint)message.Length);

        await stream.WriteAsync(header, ct);
        await stream.WriteAsync(message, ct);
        await stream.FlushAsync(ct);
    }

    private static async Task<int> ReadExactAsync(NetworkStream stream, byte[] buffer, CancellationToken ct)
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
