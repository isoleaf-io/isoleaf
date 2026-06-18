using Iso8583Toolkit.IsoCore.Domain;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;

namespace Iso8583Toolkit.IsoCore.Validation;

public sealed class IsoMessageValidator
{
    /// <summary>
    /// Validates a parsed <see cref="IsoMessage"/> against the given layout and optional
    /// set of required bit numbers.
    /// </summary>
    /// <param name="message">The parsed message to validate.</param>
    /// <param name="layout">The layout that defines field constraints.</param>
    /// <param name="requiredBits">Bit numbers that MUST be present (e.g. [2,3,4,11] for 0200).</param>
    public ValidationResult Validate(
        IsoMessage message,
        IsoLayout layout,
        IReadOnlyCollection<int>? requiredBits = null)
    {
        var result = new ValidationResult();

        ValidateMtiFormat(message, result);
        ValidateBitmapConsistency(message, result);
        ValidateFieldLengths(message, layout, result);
        ValidateRequiredFields(message, requiredBits, result);
        ValidateUnknownFields(message, layout, result);

        return result;
    }

    // ── (d) MTI Format ───────────────────────────────────────────────────────

    private static void ValidateMtiFormat(IsoMessage message, ValidationResult result)
    {
        if (!MtiParser.IsValid(message.Mti))
            result.AddError("MTI_INVALID", "MTI",
                $"MTI '{message.Mti}' is not valid — expected exactly 4 decimal digits.");
    }

    // ── (a) Bitmap ↔ Fields consistency ──────────────────────────────────────

    private static void ValidateBitmapConsistency(IsoMessage message, ValidationResult result)
    {
        var activeBits = new HashSet<int>(message.GetActiveBits());
        // Bit 1 is the secondary-bitmap indicator, never a data field
        activeBits.Remove(1);

        // Bits active in bitmap but missing from Fields
        foreach (var bit in activeBits.Where(b => !message.Fields.ContainsKey(b)))
        {
            result.AddError("BITMAP_INCONSISTENCY", $"Bit {bit}",
                $"Bit {bit} is active in the bitmap but has no corresponding field in the message.");
        }

        // Fields present but not active in bitmap
        foreach (var bit in message.Fields.Keys.Where(b => !activeBits.Contains(b)))
        {
            result.AddError("BITMAP_INCONSISTENCY", $"Bit {bit}",
                $"Field for bit {bit} is present but the bit is not active in the bitmap.");
        }
    }

    // ── (b) + (c) Field length checks ────────────────────────────────────────

    private static void ValidateFieldLengths(
        IsoMessage message, IsoLayout layout, ValidationResult result)
    {
        foreach (var (bit, field) in message.Fields)
        {
            var def = layout.GetField(bit);
            if (def is null) continue; // handled by UnknownFields

            // (b) MaxLength — Binary fields are stored as hex (2 chars per byte)
            var maxLen = def.Encoding == IsoFieldEncoding.Binary ? def.MaxLength * 2 : def.MaxLength;
            if (field.RawValue.Length > maxLen)
                result.AddError("FIELD_TOO_LONG", $"Bit {bit}",
                    $"Bit {bit} value length {field.RawValue.Length} exceeds MaxLength {def.MaxLength}.");

            // (c) LLVAR/LLLVAR: for parsed messages the length prefix was already consumed
            //     by the parser, so we only verify the value length fits the type limits.
            var prefixMax = def.Type switch
            {
                IsoFieldType.LLVAR   => 99,
                IsoFieldType.LLLVAR  => 999,
                IsoFieldType.LLLLVAR => 9999,
                _                    => int.MaxValue
            };

            if (field.RawValue.Length > prefixMax)
                result.AddError("LLVAR_OVERFLOW", $"Bit {bit}",
                    $"Bit {bit} value length {field.RawValue.Length} cannot be expressed in a " +
                    $"{def.Type} length prefix (max {prefixMax}).");
        }
    }

    // ── (e) Required fields ──────────────────────────────────────────────────

    private static void ValidateRequiredFields(
        IsoMessage message, IReadOnlyCollection<int>? requiredBits, ValidationResult result)
    {
        if (requiredBits is null or { Count: 0 }) return;

        foreach (var bit in requiredBits.Where(b => !message.HasField(b)))
        {
            result.AddError("REQUIRED_FIELD_MISSING", $"Bit {bit}",
                $"Bit {bit} is required but not present in the message.");
        }
    }

    // ── (f) Unknown fields (warnings) ────────────────────────────────────────

    private static void ValidateUnknownFields(
        IsoMessage message, IsoLayout layout, ValidationResult result)
    {
        foreach (var bit in message.Fields.Keys.Where(b => !layout.HasField(b)))
        {
            result.AddWarning("UNKNOWN_FIELD", $"Bit {bit}",
                $"Bit {bit} is present but has no definition in layout '{layout.Name}'.");
        }
    }
}
