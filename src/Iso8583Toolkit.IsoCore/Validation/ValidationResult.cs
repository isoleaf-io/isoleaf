namespace Iso8583Toolkit.IsoCore.Validation;

public sealed class ValidationResult
{
    public List<ValidationError> Errors { get; } = [];
    public List<ValidationWarning> Warnings { get; } = [];

    public bool IsValid => Errors.Count == 0;

    public string Summary =>
        (Errors.Count, Warnings.Count) switch
        {
            (0, 0) => "Valid message",
            (0, _) => $"Valid with {Warnings.Count} warning(s)",
            _      => $"{Errors.Count} error(s), {Warnings.Count} warning(s)"
        };

    internal void AddError(string code, string field, string message) =>
        Errors.Add(new ValidationError(code, field, message));

    internal void AddWarning(string code, string field, string message) =>
        Warnings.Add(new ValidationWarning(code, field, message));
}
