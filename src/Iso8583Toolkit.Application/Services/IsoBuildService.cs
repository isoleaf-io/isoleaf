using Iso8583Toolkit.Application.DTOs;
using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;
using Iso8583Toolkit.IsoCore.Validation;

namespace Iso8583Toolkit.Application.Services;

public sealed class IsoBuildService
{
    private readonly IsoMessageValidator _validator = new();
    private readonly Dictionary<string, IsoLayout> _layouts;

    public IsoBuildService()
    {
        var defaultLayout = IsoLayout.Default();
        _layouts = new Dictionary<string, IsoLayout>(StringComparer.OrdinalIgnoreCase)
        {
            ["default"] = defaultLayout
        };
    }

    public IsoBuildResponse Build(string mti, List<FieldInput> fields, string layoutName)
    {
        var layout = ResolveLayout(layoutName);

        try
        {
            var builder = new IsoMessageBuilder()
                .WithMti(mti)
                .WithLayout(layout);

            foreach (var f in fields)
                builder.WithField(f.BitNumber, f.Value);

            var hex = builder.BuildHex();
            var binaryHex = builder.BuildBinaryHex();
            var msg = builder.Build();

            var validation = _validator.Validate(msg, layout);

            var bitmapHex = BitmapEngine.ToHex(msg.PrimaryBitmap);
            if (msg.HasSecondaryBitmap)
                bitmapHex += BitmapEngine.ToHex(msg.SecondaryBitmap);

            return new IsoBuildResponse(
                Success: true,
                Message: hex,
                BinaryHexMessage: binaryHex,
                Bitmap: bitmapHex,
                ActiveBits: msg.GetActiveBits().ToList(),
                Validation: new IsoBuildValidationSummary(
                    validation.IsValid,
                    validation.Errors,
                    validation.Warnings,
                    validation.Summary));
        }
        catch (IsoParseException ex)
        {
            return new IsoBuildResponse(
                Success: false,
                Error: $"[{ex.Field}] {ex.Message}");
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return new IsoBuildResponse(
                Success: false,
                Error: ex.Message);
        }
    }

    private IsoLayout ResolveLayout(string name) =>
        _layouts.TryGetValue(name, out var l)
            ? l
            : throw new KeyNotFoundException($"Layout '{name}' not found.");
}
