using System.Text;
using Iso8583Toolkit.Application.DTOs;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;
using Iso8583Toolkit.IsoCore.Validation;

namespace Iso8583Toolkit.Application.Services;

public sealed class IsoValidateService
{
    private readonly IsoParseService _parseService;
    private readonly IsoMessageValidator _validator = new();
    private readonly Dictionary<string, IsoLayout> _layouts;
    private readonly IsoParser _parser;

    public IsoValidateService(IsoParseService parseService)
    {
        _parseService = parseService;
        var defaultLayout = IsoLayout.Default();
        _layouts = new Dictionary<string, IsoLayout>(StringComparer.OrdinalIgnoreCase)
        {
            ["default"] = defaultLayout
        };
        _parser = new IsoParser(defaultLayout);
    }

    public IsoValidateResponse Validate(string hexMessage, string layoutName, List<int>? requiredBits)
    {
        var layout = ResolveLayout(layoutName);

        // Parse with auto-detection (binary-hex vs ASCII wire)
        IsoCore.Domain.IsoMessage message;
        try
        {
            if (IsBinaryHex(hexMessage))
            {
                try
                {
                    message = _parser.ParseFromBinaryHex(hexMessage, layout);
                }
                catch (IsoParseException)
                {
                    // Not valid binary-hex — fall through to ASCII parse
                    message = _parser.ParseFromHex(hexMessage, layout);
                }
            }
            else
            {
                message = _parser.ParseFromHex(hexMessage, layout);
            }
        }
        catch (IsoParseException ex)
        {
            return new IsoValidateResponse(
                IsValid: false,
                Errors: [new ValidationError("PARSE_FAILURE", ex.Field, ex.Message)],
                Warnings: [],
                Summary: "Parse failed: " + ex.Message);
        }

        // Validate
        var result = _validator.Validate(message, layout, requiredBits);

        // Build parsed response for the caller
        var parsed = _parseService.ParseHex(hexMessage, layoutName);

        return new IsoValidateResponse(
            IsValid: result.IsValid,
            Errors: result.Errors,
            Warnings: result.Warnings,
            Summary: result.Summary,
            ParsedMessage: parsed);
    }

    /// <summary>
    /// Detects whether the message is a binary-hex encoded byte stream.
    /// Same heuristic as <see cref="IsoParseService"/>.
    /// </summary>
    private static bool IsBinaryHex(string message)
    {
        var trimmed = message.AsSpan().Trim();

        if (trimmed.Length < 8 || trimmed.Length % 2 != 0)
            return false;

        foreach (var c in trimmed)
        {
            if (!Uri.IsHexDigit(c)) return false;
        }

        try
        {
            var mtiBytes = Convert.FromHexString(trimmed[..8]);
            var mti = Encoding.ASCII.GetString(mtiBytes);
            return MtiParser.IsValid(mti);
        }
        catch
        {
            return false;
        }
    }

    private IsoLayout ResolveLayout(string name) =>
        _layouts.TryGetValue(name, out var l)
            ? l
            : throw new KeyNotFoundException($"Layout '{name}' not found.");
}
