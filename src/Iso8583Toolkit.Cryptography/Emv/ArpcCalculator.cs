namespace Iso8583Toolkit.Cryptography.Emv;

public static class ArpcCalculator
{
    /// <summary>
    /// Calculates an ARPC (Authorization Response Cryptogram).
    /// </summary>
    public static string CalculateArpc(ArpcInput input)
    {
        return input.Method switch
        {
            ArpcMethod.Method1 => CalculateMethod1(input),
            ArpcMethod.Method2 => CalculateMethod2(input),
            _ => throw new ArgumentOutOfRangeException(nameof(input), $"Unknown ARPC method: {input.Method}")
        };
    }

    /// <summary>
    /// ARPC Method 1 (Visa/Elo):
    /// 1. Derive session key same as ARQC
    /// 2. Pad = AuthResponseCode (2 bytes) + 6 bytes 0x00
    /// 3. ARPC = 3DES_Encrypt(ARQC XOR Pad, SessionKey)
    /// </summary>
    private static string CalculateMethod1(ArpcInput input)
    {
        var sessionKey = DeriveSessionKey(input);
        var arqc = Convert.FromHexString(input.Arqc);

        // Build pad: AuthResponseCode (2 bytes) + 6 zero bytes
        var pad = new byte[8];
        var arc = Convert.FromHexString(input.AuthResponseCode);
        Buffer.BlockCopy(arc, 0, pad, 0, Math.Min(arc.Length, 2));

        // XOR ARQC with pad
        var xored = new byte[8];
        for (var i = 0; i < 8; i++)
            xored[i] = (byte)(arqc[i] ^ pad[i]);

        // 3DES encrypt
        var arpc = SessionKeyDerivation.TripleDesEncrypt(xored, sessionKey);

        return Convert.ToHexString(arpc);
    }

    /// <summary>
    /// ARPC Method 2 (Mastercard M/Chip):
    /// 1. Derive session key
    /// 2. Data = ARQC (8 bytes) || CSU (4 bytes) || 0x00000000 (4 bytes)
    /// 3. ARPC = MAC 3DES-CBC of 16 bytes with SessionKey
    /// </summary>
    private static string CalculateMethod2(ArpcInput input)
    {
        var sessionKey = DeriveSessionKey(input);
        var arqc = Convert.FromHexString(input.Arqc);

        // Build data: ARQC (8) || CSU (4) || padding (4 zeros)
        var data = new byte[16];
        Buffer.BlockCopy(arqc, 0, data, 0, 8);

        if (!string.IsNullOrEmpty(input.Csu))
        {
            var csu = Convert.FromHexString(input.Csu);
            Buffer.BlockCopy(csu, 0, data, 8, Math.Min(csu.Length, 4));
        }
        // data[12..15] are already 0x00

        // Apply ISO 9797-1 Method 2 padding
        var padded = ArqcCalculator.ApplyPadding(data);

        // MAC calculation using session key
        var arpc = CalculateMac(padded, sessionKey);

        return Convert.ToHexString(arpc);
    }

    private static byte[] DeriveSessionKey(ArpcInput input)
    {
        var issuerMasterKey = Convert.FromHexString(input.IccMasterKey);
        var iccMk = SessionKeyDerivation.DeriveMasterKey(input.Pan, input.PanSequenceNumber, issuerMasterKey);
        var atcBytes = Convert.FromHexString(input.Atc);
        return SessionKeyDerivation.DeriveSessionKey(iccMk, atcBytes, input.Profile);
    }

    /// <summary>
    /// 3DES-CBC MAC per ISO/IEC 9797-1 Algorithm 3.
    /// </summary>
    private static byte[] CalculateMac(byte[] paddedData, byte[] key)
    {
        var keyLeft = key[..8];
        var keyRight = key[8..16];

        var result = new byte[8];

        for (var i = 0; i < paddedData.Length; i += 8)
        {
            var block = new byte[8];
            Buffer.BlockCopy(paddedData, i, block, 0, 8);

            for (var j = 0; j < 8; j++)
                block[j] ^= result[j];

            if (i + 8 < paddedData.Length)
            {
                result = DesEncrypt(block, keyLeft);
            }
            else
            {
                result = DesEncrypt(block, keyLeft);
                result = DesDecrypt(result, keyRight);
                result = DesEncrypt(result, keyLeft);
            }
        }

        return result;
    }

    private static byte[] DesEncrypt(byte[] data, byte[] key)
    {
        using var des = System.Security.Cryptography.DES.Create();
        des.Key = key;
        return des.EncryptEcb(data, System.Security.Cryptography.PaddingMode.None);
    }

    private static byte[] DesDecrypt(byte[] data, byte[] key)
    {
        using var des = System.Security.Cryptography.DES.Create();
        des.Key = key;
        return des.DecryptEcb(data, System.Security.Cryptography.PaddingMode.None);
    }
}
