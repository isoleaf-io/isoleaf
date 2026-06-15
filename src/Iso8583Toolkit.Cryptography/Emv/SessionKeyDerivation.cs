using System.Security.Cryptography;

namespace Iso8583Toolkit.Cryptography.Emv;

public static class SessionKeyDerivation
{
    /// <summary>
    /// Derives the ICC Master Key from the Issuer Master Key using PAN and PAN Sequence Number.
    /// Algorithm: 3DES encrypt diversification data with IMK.
    /// Left half: encrypt left 8 bytes of PAN-derived data.
    /// Right half: encrypt inverted left 8 bytes.
    /// </summary>
    public static byte[] DeriveMasterKey(string pan, string panSequenceNumber, byte[] issuerMasterKey)
    {
        // Build diversification data: PAN + PAN Sequence Number, right-justified, zero-padded to 16 hex chars
        var divData = (pan + panSequenceNumber).PadLeft(16, '0');
        if (divData.Length > 16)
            divData = divData[^16..];

        var divBytes = Convert.FromHexString(divData);

        // Left half of ICC Master Key: 3DES encrypt divBytes with IMK
        var leftHalf = TripleDesEncrypt(divBytes, issuerMasterKey);

        // Right half: invert all bits of divBytes, then 3DES encrypt with IMK
        var invertedDiv = new byte[divBytes.Length];
        for (var i = 0; i < divBytes.Length; i++)
            invertedDiv[i] = (byte)(divBytes[i] ^ 0xFF);

        var rightHalf = TripleDesEncrypt(invertedDiv, issuerMasterKey);

        // ICC Master Key = leftHalf || rightHalf
        var iccMk = new byte[16];
        Buffer.BlockCopy(leftHalf, 0, iccMk, 0, 8);
        Buffer.BlockCopy(rightHalf, 0, iccMk, 8, 8);

        return FixDesKeyParity(iccMk);
    }

    /// <summary>
    /// Derives a session key from the ICC Master Key and ATC.
    /// </summary>
    public static byte[] DeriveSessionKey(byte[] masterKey, byte[] atc, EmvProfile profile)
    {
        return profile switch
        {
            EmvProfile.Visa => DeriveSessionKeyVisa(masterKey, atc),
            EmvProfile.Mastercard or EmvProfile.Elo => DeriveSessionKeyCskd(masterKey, atc),
            _ => throw new ArgumentOutOfRangeException(nameof(profile))
        };
    }

    /// <summary>
    /// Visa session key derivation using ATC.
    /// Left half: 3DES encrypt (ATC || 00 00 00 00 00 00) with MK
    /// Right half: 3DES encrypt (ATC inverted || FF FF FF FF FF FF) with MK
    /// </summary>
    private static byte[] DeriveSessionKeyVisa(byte[] masterKey, byte[] atc)
    {
        // Left: ATC (2 bytes) + 6 zero bytes
        var leftData = new byte[8];
        Buffer.BlockCopy(atc, 0, leftData, 0, 2);

        var leftHalf = TripleDesEncrypt(leftData, masterKey);

        // Right: inverted ATC (2 bytes) + 6 FF bytes
        var rightData = new byte[8];
        rightData[0] = (byte)(atc[0] ^ 0xFF);
        rightData[1] = (byte)(atc[1] ^ 0xFF);
        for (var i = 2; i < 8; i++)
            rightData[i] = 0xFF;

        var rightHalf = TripleDesEncrypt(rightData, masterKey);

        var sessionKey = new byte[16];
        Buffer.BlockCopy(leftHalf, 0, sessionKey, 0, 8);
        Buffer.BlockCopy(rightHalf, 0, sessionKey, 8, 8);

        return FixDesKeyParity(sessionKey);
    }

    /// <summary>
    /// Common Session Key Derivation (CSKD) — used by Mastercard and Elo.
    /// F1 = ATC || 00 || 00 || 00 || 00 || 00 || 00 → left diversification
    /// F2 = ATC || 00 || 00 || 00 || 00 || 00 || 00 → right diversification (with F8=0xF0)
    /// </summary>
    private static byte[] DeriveSessionKeyCskd(byte[] masterKey, byte[] atc)
    {
        // Left session key half
        var r = new byte[8];
        Buffer.BlockCopy(atc, 0, r, 0, 2);
        r[2] = 0xF0; // Indicates left half derivation
        // r[3..7] = 0x00

        var leftHalf = TripleDesEncrypt(r, masterKey);

        // Right session key half
        var r2 = new byte[8];
        Buffer.BlockCopy(atc, 0, r2, 0, 2);
        r2[2] = 0x0F; // Indicates right half derivation
        // r2[3..7] = 0x00

        var rightHalf = TripleDesEncrypt(r2, masterKey);

        var sessionKey = new byte[16];
        Buffer.BlockCopy(leftHalf, 0, sessionKey, 0, 8);
        Buffer.BlockCopy(rightHalf, 0, sessionKey, 8, 8);

        return FixDesKeyParity(sessionKey);
    }

    /// <summary>
    /// 3DES-EDE encrypt a single 8-byte block with a 16-byte key.
    /// Uses manual DES E-D-E to avoid .NET's weak key rejection.
    /// </summary>
    internal static byte[] TripleDesEncrypt(byte[] data, byte[] key)
    {
        var k1 = key[..8];
        var k2 = key[8..16];

        var step1 = DesOp(data, k1, encrypt: true);
        var step2 = DesOp(step1, k2, encrypt: false);
        var step3 = DesOp(step2, k1, encrypt: true);
        return step3;
    }

    /// <summary>
    /// 3DES-EDE decrypt a single 8-byte block with a 16-byte key.
    /// </summary>
    internal static byte[] TripleDesDecrypt(byte[] data, byte[] key)
    {
        var k1 = key[..8];
        var k2 = key[8..16];

        var step1 = DesOp(data, k1, encrypt: false);
        var step2 = DesOp(step1, k2, encrypt: true);
        var step3 = DesOp(step2, k1, encrypt: false);
        return step3;
    }

    /// <summary>
    /// Single DES encrypt/decrypt without weak key validation.
    /// </summary>
    private static byte[] DesOp(byte[] data, byte[] key, bool encrypt)
    {
        using var des = DES.Create();
        // Bypass weak key check by setting key via reflection or using raw transform
        // lgtm[cs/ecb-encryption] ECB mode is mandated by EMV spec (ISO 9564 / EMV Book 2) for CVV, ARPC and session key derivation
        des.Mode = CipherMode.ECB;
        des.Padding = PaddingMode.None;

        // Use ICryptoTransform directly to avoid weak key check on set_Key
        using var transform = encrypt
            ? des.CreateEncryptor(key, null)
            : des.CreateDecryptor(key, null);

        return transform.TransformFinalBlock(data, 0, data.Length);
    }

    /// <summary>
    /// Adjusts DES key parity bits (odd parity on each byte).
    /// </summary>
    private static byte[] FixDesKeyParity(byte[] key)
    {
        var result = new byte[key.Length];
        for (var i = 0; i < key.Length; i++)
        {
            var b = key[i] & 0xFE;
            // Count bits set in the upper 7 bits
            var bits = 0;
            var temp = b;
            while (temp > 0)
            {
                bits += temp & 1;
                temp >>= 1;
            }
            // Set parity bit for odd parity
            result[i] = (byte)(b | (bits % 2 == 0 ? 1 : 0));
        }
        return result;
    }
}
