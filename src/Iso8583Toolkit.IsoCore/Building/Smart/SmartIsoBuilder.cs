using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;

namespace Iso8583Toolkit.IsoCore.Building.Smart;

/// <summary>
/// Orchestrates smart ISO 8583 message generation: resolves brand profile,
/// mandatory bits, generates field values, and builds the final message.
/// </summary>
public sealed class SmartIsoBuilder
{
    private readonly BrandProfileLoader _profileLoader = new();
    private readonly MandatoryFieldResolver _resolver = new();
    private readonly FieldValueGenerator _valueGen = new();
    private readonly ICardDataProvider _cardProvider;
    private readonly IsoLayout _layout;

    public SmartIsoBuilder(ICardDataProvider cardProvider, IsoLayout? layout = null)
    {
        _cardProvider = cardProvider;
        _layout = layout ?? IsoLayout.Default();
    }

    public SmartBuildResult Build(TransactionProfile profile)
    {
        try
        {
            return BuildInternal(profile);
        }
        catch (Exception ex)
        {
            return SmartBuildResult.Fail(ex.Message);
        }
    }

    private SmartBuildResult BuildInternal(TransactionProfile profile)
    {
        var customs = profile.CustomFields ?? new Dictionary<int, string>();
        var allRules = new List<string>();

        // 1. Resolve PAN + brand
        var pan = customs.TryGetValue(2, out var customPan) ? customPan : null;
        SmartBrand brand;
        if (pan is not null)
        {
            brand = profile.Brand is SmartBrand.Auto
                ? _cardProvider.DetectBrand(pan)
                : profile.Brand;
            allRules.Add("CustomPAN→BrandDetected");
        }
        else
        {
            brand = profile.Brand is SmartBrand.Auto ? SmartBrand.Default : profile.Brand;
            pan = _cardProvider.GeneratePan(brand);
            allRules.Add($"PAN→Generated({brand})");
        }

        // 2. Load brand profile
        var brandProfile = _profileLoader.Load(brand);

        // 3. Expiry
        var expiry = customs.TryGetValue(14, out var customExp)
            ? customExp
            : _cardProvider.GenerateExpiry();

        // 4. Track 2 (derived from PAN unless custom)
        string track2;
        if (customs.TryGetValue(35, out var customTrack2))
        {
            track2 = customTrack2;
        }
        else
        {
            var serviceCode = "201";
            var cvv = _cardProvider.GenerateCvv(pan, expiry, serviceCode);
            track2 = _cardProvider.GenerateTrack2(pan, expiry, serviceCode, cvv);
            allRules.Add("Track2→DerivedFromPAN");
        }

        // 5. Resolve mandatory bits
        var (mandatoryBits, resolverRules) = _resolver.Resolve(
            profile.Mti, profile.Role, brandProfile,
            profile.Channel, profile.TransactionType,
            profile.ApprovalMode, profile.Installments, profile.IsReversal);
        allRules.AddRange(resolverRules);

        // 6. Build context
        var amount = customs.TryGetValue(4, out var customAmt) ? customAmt : null;
        var ctx = new SmartFieldContext
        {
            Pan = pan,
            Expiry = expiry,
            Track2 = track2,
            CurrencyCode = brandProfile.DefaultCurrencyCode,
            CountryCode = brandProfile.DefaultCountryCode,
            TransactionType = profile.TransactionType,
            Channel = profile.Channel,
            Amount = amount,
            Brand = brand,
            Workspace = profile.WorkspaceKeys,
        };

        // 7. Generate values for each mandatory bit
        var fieldInfos = new List<SmartFieldInfo>();
        var builder = new IsoMessageBuilder()
            .WithMti(profile.Mti)
            .WithLayout(_layout);

        foreach (var bit in mandatoryBits)
        {
            string value;
            SmartFieldOrigin origin;
            string? rule = null;

            if (customs.TryGetValue(bit, out var customValue))
            {
                value = customValue;
                origin = SmartFieldOrigin.Custom;
            }
            else
            {
                var generated = _valueGen.Generate(bit, ctx);
                if (generated is null) continue;
                value = generated;
                origin = SmartFieldOrigin.Generated;
            }

            builder.WithField(bit, value);

            var def = _layout.GetField(bit);
            var name = def?.Name ?? $"Bit {bit}";
            var masked = MaskValue(bit, value);

            fieldInfos.Add(new SmartFieldInfo(bit, name, value, masked, origin, rule));
        }

        // Also add any custom fields not in mandatory list
        foreach (var (bit, value) in customs)
        {
            if (mandatoryBits.Contains(bit)) continue;
            builder.WithField(bit, value);
            var def = _layout.GetField(bit);
            fieldInfos.Add(new SmartFieldInfo(
                bit, def?.Name ?? $"Bit {bit}", value,
                MaskValue(bit, value), SmartFieldOrigin.Custom));
            allRules.Add($"CustomField→Bit{bit}Added");
        }

        // 8. Re-derive dependents after custom overrides
        if (customs.ContainsKey(2) && !customs.ContainsKey(35) && mandatoryBits.Contains(35))
        {
            // PAN was customized → re-derive Track 2 (only if bit 35 is active)
            var svc = "201";
            var cvv = _cardProvider.GenerateCvv(pan, expiry, svc);
            var newTrack2 = _cardProvider.GenerateTrack2(pan, expiry, svc, cvv);
            UpdateField(builder, fieldInfos, 35, newTrack2, SmartFieldOrigin.Derived, "Derived→Track2FromCustomPAN");
        }
        if (customs.ContainsKey(4) && mandatoryBits.Contains(55) && !customs.ContainsKey(55))
        {
            // Amount customized → regenerate EMV TLV so 9F02 (and the ARQC over it) is current.
            var emv = _valueGen.GenerateEmvData(ctx);
            UpdateField(builder, fieldInfos, 55, emv, SmartFieldOrigin.Derived, "Derived→EMVAmountUpdated");
            allRules.Add("Derived→EMVAmountUpdated");
        }

        // 9. Build message
        var asciiWire = builder.BuildHex();
        var binaryHex = builder.BuildBinaryHex();
        var msg = builder.Build();

        // 10. TPDU
        string? tpdu = ResolveTpdu(profile, brandProfile);
        if (tpdu is not null) allRules.Add("TPDU→Generated");

        // 11. Extract generated PIN if bit 52 was generated
        string? generatedPin = null;
        if (mandatoryBits.Contains(52) && !customs.ContainsKey(52))
            generatedPin = "(random 4-digit PIN, block encrypted)";

        // Sort fields
        fieldInfos = fieldInfos.OrderBy(f => f.BitNumber).ToList();

        // ArqcIsSimulated reflects the LAST generation of bit 55 — when bit 55 is
        // absent we keep the safe default (true) but it carries no semantic meaning
        // for the caller (ActiveBits won't contain 55).
        var bit55Present = mandatoryBits.Contains(55) || customs.ContainsKey(55);
        var arqcIsSimulated = !bit55Present || customs.ContainsKey(55) || _valueGen.LastArqcWasSimulated;

        return new SmartBuildResult
        {
            Success = true,
            Message = asciiWire,
            BinaryHexMessage = binaryHex,
            Tpdu = tpdu,
            Bitmap = BitmapEngine.ToHex(msg.PrimaryBitmap) +
                     (msg.HasSecondaryBitmap ? BitmapEngine.ToHex(msg.SecondaryBitmap) : ""),
            ActiveBits = msg.GetActiveBits().ToList(),
            Fields = fieldInfos,
            GeneratedPan = pan,
            GeneratedPin = generatedPin,
            ProfileUsed = brandProfile.BrandName,
            AppliedRules = allRules.ToArray(),
            ArqcIsSimulated = arqcIsSimulated,
        };
    }

    private static void UpdateField(IsoMessageBuilder builder, List<SmartFieldInfo> infos,
        int bit, string value, SmartFieldOrigin origin, string? rule)
    {
        builder.WithField(bit, value);
        var idx = infos.FindIndex(f => f.BitNumber == bit);
        var info = new SmartFieldInfo(bit, infos[idx >= 0 ? idx : 0].Name, value,
            MaskValue(bit, value), origin, rule);
        if (idx >= 0) infos[idx] = info;
        else infos.Add(info);
    }

    private static string? ResolveTpdu(TransactionProfile profile, BrandProfile brandProfile)
    {
        if (profile.OverrideTpdu is not null)
        {
            return string.Equals(profile.OverrideTpdu, "NONE", StringComparison.OrdinalIgnoreCase)
                ? null
                : profile.OverrideTpdu;
        }

        var needsTpdu = profile.Role switch
        {
            SmartRole.Adquirente => brandProfile.RequiresTpduAdquirenteToBrand,
            SmartRole.Bandeira or SmartRole.Emissor or SmartRole.Autorizador
                => brandProfile.RequiresTpduBrandToIssuer,
            _ => false
        };

        if (!needsTpdu) return null;

        // Auto-generate
        var dest = Random.Shared.Next(1, 10000).ToString("D4");
        var src = Random.Shared.Next(1, 10000).ToString("D4");

        Span<byte> buf = stackalloc byte[5];
        buf[0] = 0x60;
        buf[1] = (byte)(((dest[0] - '0') << 4) | (dest[1] - '0'));
        buf[2] = (byte)(((dest[2] - '0') << 4) | (dest[3] - '0'));
        buf[3] = (byte)(((src[0] - '0') << 4) | (src[1] - '0'));
        buf[4] = (byte)(((src[2] - '0') << 4) | (src[3] - '0'));
        return Convert.ToHexString(buf);
    }

    private static string MaskValue(int bit, string value) =>
        bit switch
        {
            2 when value.Length > 6 => value[..6] + new string('*', value.Length - 10) + value[^4..],
            35 => value.Length > 10 ? value[..6] + "****" + value[^4..] : value,
            52 => "****************",
            _ => value
        };
}
