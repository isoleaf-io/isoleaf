using Iso8583Toolkit.IsoCore.Validation;

namespace Iso8583Toolkit.Application.DTOs;

public sealed record IsoValidateResponse(
    bool IsValid,
    List<ValidationError> Errors,
    List<ValidationWarning> Warnings,
    string Summary,
    IsoParseResponse? ParsedMessage = null);
