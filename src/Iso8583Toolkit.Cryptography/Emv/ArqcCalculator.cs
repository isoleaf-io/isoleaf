namespace Iso8583Toolkit.Cryptography.Emv;

public static class ArqcCalculator
{
    /// <summary>
    /// Calculates an ARQC (Authorization Request Cryptogram) using the standard EMV algorithm.
    /// </summary>
    public static string CalculateArqc(ArqcInput input)
    {
        // Step 1 — Derive ICC Master Key
        var issuerMasterKey = Convert.FromHexString(input.IccMasterKey);
        var iccMk = SessionKeyDerivation.DeriveMasterKey(input.Pan, input.PanSequenceNumber, issuerMasterKey);

        // Step 2 — Derive Session Key
        var atcBytes = Convert.FromHexString(input.Atc);
        var sessionKey = SessionKeyDerivation.DeriveSessionKey(iccMk, atcBytes, input.Profile);

        // Step 3 — Build transaction data
        var txnData = BuildTransactionData(input);

        // Step 4 — Apply ISO/IEC 9797-1 Method 2 padding
        var padded = ApplyPadding(txnData);

        // Step 5 — Calculate MAC (3DES-CBC with IV=0)
        var arqc = CalculateMac(padded, sessionKey);

        return Convert.ToHexString(arqc);
    }

    /// <summary>
    /// Calculates ARQC using a pre-derived session key (for testing/validation).
    /// </summary>
    public static string CalculateArqcWithSessionKey(byte[] sessionKey, byte[] transactionData)
    {
        var padded = ApplyPadding(transactionData);
        var arqc = CalculateMac(padded, sessionKey);
        return Convert.ToHexString(arqc);
    }

    /// <summary>
    /// Derives the session key for the given input (exposed for debugging).
    /// </summary>
    public static byte[] DeriveSessionKey(ArqcInput input)
    {
        var issuerMasterKey = Convert.FromHexString(input.IccMasterKey);
        var iccMk = SessionKeyDerivation.DeriveMasterKey(input.Pan, input.PanSequenceNumber, issuerMasterKey);
        var atcBytes = Convert.FromHexString(input.Atc);
        return SessionKeyDerivation.DeriveSessionKey(iccMk, atcBytes, input.Profile);
    }

    /// <summary>
    /// Derives the ICC Master Key for the given input (exposed for debugging).
    /// </summary>
    public static byte[] DeriveIccMasterKey(ArqcInput input)
    {
        var issuerMasterKey = Convert.FromHexString(input.IccMasterKey);
        return SessionKeyDerivation.DeriveMasterKey(input.Pan, input.PanSequenceNumber, issuerMasterKey);
    }

    /// <summary>
    /// Builds the transaction data block by concatenating EMV fields in order.
    /// </summary>
    public static byte[] BuildTransactionData(ArqcInput input)
    {
        using var ms = new MemoryStream();

        ms.Write(Convert.FromHexString(input.AmountAuthorized));    // 9F02 — 6 bytes
        ms.Write(Convert.FromHexString(input.AmountOther));         // 9F03 — 6 bytes
        ms.Write(Convert.FromHexString(input.TerminalCountryCode)); // 9F1A — 2 bytes
        ms.Write(Convert.FromHexString(input.Tvr));                 // 95   — 5 bytes
        ms.Write(Convert.FromHexString(input.CurrencyCode));        // 5F2A — 2 bytes
        ms.Write(Convert.FromHexString(input.TransactionDate));     // 9A   — 3 bytes
        ms.Write(Convert.FromHexString(input.TransactionType));     // 9C   — 1 byte
        ms.Write(Convert.FromHexString(input.UnpredictableNumber)); // 9F37 — 4 bytes
        ms.Write(Convert.FromHexString(input.Aip));                 // 82   — 2 bytes
        ms.Write(Convert.FromHexString(input.Atc));                 // 9F36 — 2 bytes
        ms.Write(Convert.FromHexString(input.Iad));                 // 9F10 — variable

        return ms.ToArray();
    }

    /// <summary>
    /// Applies ISO/IEC 9797-1 Method 2 padding:
    /// Append 0x80 then zeros until length is a multiple of 8.
    /// </summary>
    public static byte[] ApplyPadding(byte[] data)
    {
        var paddedLength = data.Length + 1; // +1 for 0x80
        var remainder = paddedLength % 8;
        if (remainder != 0)
            paddedLength += 8 - remainder;

        var padded = new byte[paddedLength];
        Buffer.BlockCopy(data, 0, padded, 0, data.Length);
        padded[data.Length] = 0x80;
        // Remaining bytes are already 0x00

        return padded;
    }

    /// <summary>
    /// Calculates 3DES-CBC MAC per ISO/IEC 9797-1 Algorithm 3.
    /// Process all blocks with single DES (left key), then final block with full 3DES.
    /// </summary>
    private static byte[] CalculateMac(byte[] paddedData, byte[] key)
    {
        var keyLeft = key[..8];
        var keyRight = key[8..16];

        // IV = 8 zero bytes
        var result = new byte[8];

        // Process each 8-byte block
        for (var i = 0; i < paddedData.Length; i += 8)
        {
            var block = new byte[8];
            Buffer.BlockCopy(paddedData, i, block, 0, 8);

            // XOR with previous result
            for (var j = 0; j < 8; j++)
                block[j] ^= result[j];

            if (i + 8 < paddedData.Length)
            {
                // Intermediate blocks: single DES encrypt with left key
                result = DesEncrypt(block, keyLeft);
            }
            else
            {
                // Final block: full 3DES (encrypt K1, decrypt K2, encrypt K1)
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
        des.Mode = System.Security.Cryptography.CipherMode.ECB;
        des.Padding = System.Security.Cryptography.PaddingMode.None;
        return des.EncryptEcb(data, System.Security.Cryptography.PaddingMode.None);
    }

    private static byte[] DesDecrypt(byte[] data, byte[] key)
    {
        using var des = System.Security.Cryptography.DES.Create();
        des.Key = key;
        des.Mode = System.Security.Cryptography.CipherMode.ECB;
        des.Padding = System.Security.Cryptography.PaddingMode.None;
        return des.DecryptEcb(data, System.Security.Cryptography.PaddingMode.None);
    }
}
