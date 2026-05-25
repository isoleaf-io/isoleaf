using Iso8583Toolkit.IsoCore.Validation;

namespace Iso8583Toolkit.Api.DTOs;

public sealed record IsoBuildResponse(
    bool Success,
    string? Message = null,
    string? BinaryHexMessage = null,
    string? Bitmap = null,
    List<int>? ActiveBits = null,
    IsoBuildValidationSummary? Validation = null,
    string? Error = null);

public sealed record IsoBuildValidationSummary(
    bool IsValid,
    List<ValidationError> Errors,
    List<ValidationWarning> Warnings,
    string Summary);
