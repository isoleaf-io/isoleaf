using System.Security.Cryptography;

namespace Iso8583Toolkit.Cards.Cvv;

public static class CvvGenerator
{
    /// <summary>
    /// Generates a CVV (Card Verification Value) using the standard 3DES-based algorithm.
    /// Used for Track 1/Track 2 CVV (iCVV, etc.).
    /// </summary>
    /// <param name="pan">Full PAN</param>
    /// <param name="expiry">Expiry in YYMM format</param>
    /// <param name="serviceCode">3-digit service code</param>
    /// <param name="key1">Hex-encoded 16-byte DES key (left half of double-length key)</param>
    /// <param name="key2">Hex-encoded 16-byte DES key (right half of double-length key)</param>
    /// <returns>3-digit CVV string</returns>
    public static string GenerateCvv(string pan, string expiry, string serviceCode, string key1, string key2)
    {
        return ComputeCvv(pan, expiry, serviceCode, key1, key2, 3);
    }

    /// <summary>
    /// Generates a CVV2/CVC2 (printed on card back).
    /// Uses expiry and service code "000" per the CVV2 spec variant.
    /// </summary>
    public static string GenerateCvv2(string pan, string expiry, string serviceCode, string key1, string key2)
    {
        return ComputeCvv(pan, expiry, serviceCode, key1, key2, 3);
    }

    /// <summary>
    /// Core CVV computation using 3DES algorithm:
    /// 1. Concatenate PAN (right-justified, excluding check digit) + Expiry + ServiceCode, pad to 32 hex chars
    /// 2. Split into left block (16 hex = 8 bytes) and right block (16 hex = 8 bytes)
    /// 3. Encrypt left block with Key1 using single DES
    /// 4. XOR result with right block
    /// 5. Encrypt with Key1 (single DES)
    /// 6. Decrypt with Key2 (single DES)
    /// 7. Encrypt with Key1 (single DES) — this completes the 3DES EDE
    /// 8. Extract decimal digits from result, then non-decimal digits mapped to decimal
    /// 9. Return first N digits
    /// </summary>
    private static string ComputeCvv(string pan, string expiry, string serviceCode, string key1Hex, string key2Hex, int length)
    {
        // Step 1: Build the data string
        // Use PAN digits excluding the check digit (last digit)
        var panBody = pan[..^1];
        var dataString = panBody + expiry + serviceCode;

        // Pad with zeros to 32 characters
        dataString = dataString.PadRight(32, '0');

        // Step 2: Split into two 16-char (8-byte) blocks
        var leftHex = dataString[..16];
        var rightHex = dataString[16..32];

        var leftBlock = HexToBytes(leftHex);
        var rightBlock = HexToBytes(rightHex);

        var keyA = Convert.FromHexString(key1Hex);
        var keyB = Convert.FromHexString(key2Hex);

        // Step 3: Encrypt left block with Key1 (single DES)
        var encrypted = DesEncrypt(leftBlock, keyA);

        // Step 4: XOR with right block
        var xored = Xor(encrypted, rightBlock);

        // Steps 5-6-7: Triple DES (EDE) with Key1/Key2
        var step5 = DesEncrypt(xored, keyA);
        var step6 = DesDecrypt(step5, keyB);
        var step7 = DesEncrypt(step6, keyA);

        // Step 8: Decimalization
        var hexResult = Convert.ToHexString(step7);
        var digits = ExtractDigits(hexResult, length);

        return digits;
    }

    /// <summary>
    /// Extracts decimal digits from the hex string.
    /// First pass: pick all decimal digits (0-9).
    /// Second pass: map hex letters (A=0, B=1, ..., F=5) to fill remaining.
    /// </summary>
    private static string ExtractDigits(string hexString, int count)
    {
        var result = new char[count];
        var pos = 0;

        // First pass: extract digits 0-9
        foreach (var c in hexString)
        {
            if (pos >= count) break;
            if (char.IsAsciiDigit(c))
                result[pos++] = c;
        }

        // Second pass: map A-F → 0-5
        if (pos < count)
        {
            foreach (var c in hexString)
            {
                if (pos >= count) break;
                if (c is >= 'A' and <= 'F')
                    result[pos++] = (char)('0' + (c - 'A'));
                else if (c is >= 'a' and <= 'f')
                    result[pos++] = (char)('0' + (c - 'a'));
            }
        }

        // Safety: fill remaining with zeros (shouldn't happen with 16 hex chars)
        while (pos < count)
            result[pos++] = '0';

        return new string(result);
    }

    private static byte[] DesEncrypt(byte[] data, byte[] key)
    {
        using var des = DES.Create();
        des.Key = key;
        des.Mode = CipherMode.ECB;
        des.Padding = PaddingMode.None;
        return des.EncryptEcb(data, PaddingMode.None);
    }

    private static byte[] DesDecrypt(byte[] data, byte[] key)
    {
        using var des = DES.Create();
        des.Key = key;
        des.Mode = CipherMode.ECB;
        des.Padding = PaddingMode.None;
        return des.DecryptEcb(data, PaddingMode.None);
    }

    private static byte[] Xor(byte[] a, byte[] b)
    {
        var result = new byte[a.Length];
        for (var i = 0; i < a.Length; i++)
            result[i] = (byte)(a[i] ^ b[i]);
        return result;
    }

    /// <summary>
    /// Treats each character in the hex string as a nibble value (not ASCII hex decoding).
    /// E.g., "4111111111111111" → bytes [0x41, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11]
    /// </summary>
    private static byte[] HexToBytes(string hex)
    {
        var bytes = new byte[hex.Length / 2];
        for (var i = 0; i < bytes.Length; i++)
        {
            var hi = HexCharToNibble(hex[i * 2]);
            var lo = HexCharToNibble(hex[i * 2 + 1]);
            bytes[i] = (byte)((hi << 4) | lo);
        }
        return bytes;
    }

    private static int HexCharToNibble(char c) => c switch
    {
        >= '0' and <= '9' => c - '0',
        >= 'A' and <= 'F' => c - 'A' + 10,
        >= 'a' and <= 'f' => c - 'a' + 10,
        _ => throw new ArgumentException($"Invalid hex character: '{c}'.")
    };
}
