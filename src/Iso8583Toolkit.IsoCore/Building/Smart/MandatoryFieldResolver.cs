namespace Iso8583Toolkit.IsoCore.Building.Smart;

/// <summary>
/// Resolves the final set of mandatory bits for a message, starting from the
/// brand profile's base list and applying contextual rules (channel, tx type, etc.).
/// </summary>
public sealed class MandatoryFieldResolver
{
    /// <summary>
    /// Resolves bits and returns the list plus the rules that were applied.
    /// </summary>
    public (List<int> Bits, List<string> AppliedRules) Resolve(
        string mti, SmartRole role, BrandProfile profile,
        TransactionChannel channel, TransactionType txType,
        ApprovalMode approvalMode, int installments, bool isReversal)
    {
        var key = $"{mti}:{role}";
        var rules = new List<string>();

        // Start from profile mandatory bits
        var bits = new HashSet<int>();
        if (profile.MandatoryBitsByMtiAndRole.TryGetValue(key, out var baseBits))
            bits.UnionWith(baseBits);

        // Add conditional bits from profile
        if (profile.ConditionalBitsByMtiAndRole.TryGetValue(key, out var condBits))
            bits.UnionWith(condBits);

        // Network management messages get no further rules
        if (mti is "0800" or "0810")
            return (bits.Order().ToList(), rules);

        // ── Channel-driven rules ────────────────────────────────────────────

        if (channel is TransactionChannel.Chip or TransactionChannel.Contactless)
        {
            bits.Add(55);
            rules.Add($"{channel}→Bit55Added");
        }

        if (channel is TransactionChannel.Tarja or TransactionChannel.Chip
            or TransactionChannel.Contactless or TransactionChannel.Fallback)
        {
            bits.Add(35);
            rules.Add($"{channel}→Bit35Added");
        }

        if (channel is TransactionChannel.CNP)
        {
            bits.Remove(35);
            bits.Remove(52);
            rules.Add("CNP→Bit35Removed");
            rules.Add("CNP→Bit52Removed");
        }

        if (channel is TransactionChannel.Fallback)
        {
            bits.Remove(55);
            rules.Add("Fallback→Bit55Removed");
        }

        // ── Transaction type rules ──────────────────────────────────────────

        if (txType is TransactionType.Debito or TransactionType.Saque
            && channel is not TransactionChannel.CNP)
        {
            bits.Add(52);
            rules.Add($"{txType}→Bit52Added");
        }

        if (txType is TransactionType.Saque)
        {
            rules.Add("Saque→ProcessingCode010000");
        }

        // ── Approval mode rules ─────────────────────────────────────────────

        if (approvalMode is ApprovalMode.Standin)
        {
            bits.Remove(55);
            rules.Add("Standin→Bit55Removed");
        }

        // ── Installments ────────────────────────────────────────────────────

        if (installments > 1)
        {
            rules.Add($"Installments{installments}→ParceladoSignal");
        }

        // ── Reversal ────────────────────────────────────────────────────────

        // A 04xx MTI is inherently a reversal — auto-include bit 90 even when
        // the legacy isReversal flag is not set.
        var effectiveReversal = isReversal || mti.StartsWith("04");
        if (effectiveReversal)
        {
            bits.Add(90);
            rules.Add("Reversal→Bit90Added");
            if (!mti.StartsWith("04"))
                rules.Add("Reversal→MTI should be 04xx");
        }

        return (bits.Order().ToList(), rules);
    }
}
