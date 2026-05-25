namespace Iso8583Toolkit.IsoCore.Parsing;

/// <summary>
/// Provides static methods for parsing, serialising and querying ISO 8583 bitmaps.
///
/// An ISO 8583 bitmap is 8 bytes (64 bits).  Each bit N (1-indexed, MSB first)
/// indicates whether field N is present in the message.  Bit 1 of the primary
/// bitmap, when set, signals that a secondary bitmap is appended immediately
/// after the primary one, extending the addressable fields to 128.
/// </summary>
public static class BitmapEngine
{
    private const int BitmapBits = 64;
    private const int BitmapBytes = 8;         // 64 bits / 8
    private const int HexCharsPerBitmap = 16;  // 8 bytes × 2 hex chars

    // ── Parse ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Parses a 16-character hex string (e.g. "7230000000000000") into a 64-element
    /// boolean array where index 0 represents bit 1 (MSB of the first byte).
    /// </summary>
    /// <param name="hexBitmap">Exactly 16 hexadecimal characters (case-insensitive).</param>
    /// <exception cref="ArgumentException">Thrown when the string length is not 16.</exception>
    public static bool[] ParseFromHex(string hexBitmap)
    {
        if (hexBitmap is null)
            throw new ArgumentNullException(nameof(hexBitmap));

        var clean = hexBitmap.Trim();
        if (clean.Length != HexCharsPerBitmap)
            throw new ArgumentException(
                $"Hex bitmap must be exactly {HexCharsPerBitmap} characters long, got {clean.Length}.",
                nameof(hexBitmap));

        var bytes = Convert.FromHexString(clean);
        return ParseFromBytes(bytes);
    }

    /// <summary>
    /// Converts an 8-byte array into a 64-element boolean array.
    /// Bit 1 (MSB of byte 0) maps to index 0; bit 64 (LSB of byte 7) maps to index 63.
    /// </summary>
    /// <param name="bytes">Exactly 8 bytes.</param>
    /// <exception cref="ArgumentException">Thrown when the array length is not 8.</exception>
    public static bool[] ParseFromBytes(byte[] bytes)
    {
        if (bytes is null)
            throw new ArgumentNullException(nameof(bytes));
        if (bytes.Length != BitmapBytes)
            throw new ArgumentException(
                $"Bitmap byte array must be exactly {BitmapBytes} bytes long, got {bytes.Length}.",
                nameof(bytes));

        var bits = new bool[BitmapBits];
        for (var byteIndex = 0; byteIndex < BitmapBytes; byteIndex++)
        {
            var b = bytes[byteIndex];
            for (var bitIndex = 0; bitIndex < 8; bitIndex++)
            {
                // MSB of each byte = lowest bit number in that byte's group
                bits[byteIndex * 8 + bitIndex] = (b & (0x80 >> bitIndex)) != 0;
            }
        }

        return bits;
    }

    // ── Serialise ────────────────────────────────────────────────────────────

    /// <summary>
    /// Converts a 64-element boolean array back to a 16-character uppercase hex string.
    /// </summary>
    /// <param name="bitmap">Exactly 64 booleans.</param>
    public static string ToHex(bool[] bitmap) =>
        Convert.ToHexString(ToBytes(bitmap));

    /// <summary>
    /// Converts a 64-element boolean array to an 8-byte array.
    /// </summary>
    /// <param name="bitmap">Exactly 64 booleans.</param>
    /// <exception cref="ArgumentException">Thrown when the array length is not 64.</exception>
    public static byte[] ToBytes(bool[] bitmap)
    {
        if (bitmap is null)
            throw new ArgumentNullException(nameof(bitmap));
        if (bitmap.Length != BitmapBits)
            throw new ArgumentException(
                $"Bitmap bool array must be exactly {BitmapBits} elements long, got {bitmap.Length}.",
                nameof(bitmap));

        var bytes = new byte[BitmapBytes];
        for (var byteIndex = 0; byteIndex < BitmapBytes; byteIndex++)
        {
            byte b = 0;
            for (var bitIndex = 0; bitIndex < 8; bitIndex++)
            {
                if (bitmap[byteIndex * 8 + bitIndex])
                    b |= (byte)(0x80 >> bitIndex);
            }
            bytes[byteIndex] = b;
        }

        return bytes;
    }

    // ── Query ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns the 1-based bit numbers of every active (true) position in the bitmap.
    /// </summary>
    /// <param name="bitmap">A 64-element boolean array.</param>
    public static IEnumerable<int> GetActiveBits(bool[] bitmap)
    {
        if (bitmap is null)
            throw new ArgumentNullException(nameof(bitmap));

        for (var i = 0; i < bitmap.Length; i++)
            if (bitmap[i]) yield return i + 1;
    }

    /// <summary>
    /// Returns <c>true</c> when bit 1 (index 0) of the primary bitmap is set,
    /// indicating a secondary bitmap is present in the message.
    /// </summary>
    /// <param name="primaryBitmap">The parsed primary bitmap (64 elements).</param>
    public static bool IsSecondaryPresent(bool[] primaryBitmap)
    {
        if (primaryBitmap is null)
            throw new ArgumentNullException(nameof(primaryBitmap));
        if (primaryBitmap.Length == 0)
            return false;

        return primaryBitmap[0];
    }
}
