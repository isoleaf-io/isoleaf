using System.Xml;
using System.Xml.Schema;
using Iso8583Toolkit.Iso20022.Services;

namespace Iso8583Toolkit.Iso20022.Validation;

/// <summary>
/// Outcome of a schema upload attempt — success carries the persisted
/// filename + resolved namespace; failure carries a caller-friendly
/// message (line/reason) so the frontend can render it verbatim.
/// </summary>
public sealed record SchemaUploadResult(
    bool Success,
    string? FileName,
    string? MessageType,
    string? Namespace,
    string? Error,
    int? LineNumber,
    int? LinePosition);

/// <summary>
/// Handles the validate-then-persist half of the Workspace schemas
/// upload endpoint. Reads the incoming bytes, parses the document as
/// an <see cref="XmlSchema"/>, and only when the schema also compiles
/// under an <see cref="XmlSchemaSet"/> is it written to disk. On
/// success the service reloads both the <see cref="SchemaRegistry"/>
/// (source of truth) and the <see cref="ReferenceService"/> (extracted
/// field maps that the Reference / Comparator / Builder screens read
/// from), so the new schema is queryable end-to-end in the same request.
/// </summary>
public sealed class SchemaUploadService
{
    private readonly SchemaRegistry _registry;
    // Optional — when supplied, the reference snapshot is rebuilt after
    // the registry so the Reference / Version-Comparator / Builder
    // screens see the newly uploaded XSD immediately. The tests still
    // exercise the registry-only path via the single-arg constructor.
    private readonly ReferenceService? _referenceService;

    public SchemaUploadService(SchemaRegistry registry)
        : this(registry, referenceService: null) { }

    public SchemaUploadService(SchemaRegistry registry, ReferenceService? referenceService)
    {
        ArgumentNullException.ThrowIfNull(registry);
        _registry = registry;
        _referenceService = referenceService;
    }

    /// <summary>
    /// Validates <paramref name="content"/> as an <c>xs:schema</c> and,
    /// on success, writes it into the registry's schemas directory,
    /// overwriting any existing file with the same target name or the
    /// same namespace+version tuple. Reloads the registry synchronously.
    /// </summary>
    /// <param name="fileName">Original uploaded filename (basename only).</param>
    /// <param name="content">Raw XSD bytes.</param>
    public SchemaUploadResult UploadSchema(string fileName, byte[] content)
    {
        // Basename sanitisation — .NET's Path.GetFileName strips any
        // directory traversal (../) and drive letters so we never write
        // outside the schemas directory even with a hostile filename.
        var safeName = string.IsNullOrWhiteSpace(fileName)
            ? "upload.xsd"
            : Path.GetFileName(fileName);
        if (!safeName.EndsWith(".xsd", StringComparison.OrdinalIgnoreCase))
            safeName += ".xsd";

        // Well-formedness + xs:schema validation. Any exception here
        // is turned into a user-facing error message with the exact
        // reason from the XML pipeline.
        XmlSchema schema;
        try
        {
            using var ms = new MemoryStream(content);
            var readerSettings = new XmlReaderSettings
            {
                DtdProcessing = DtdProcessing.Prohibit,
                XmlResolver = null,
            };
            using var reader = XmlReader.Create(ms, readerSettings);
            var parsed = XmlSchema.Read(reader, static (_, args) =>
            {
                if (args.Severity == XmlSeverityType.Error)
                    throw new XmlSchemaException(args.Message, args.Exception);
            });
            if (parsed is null)
                return Fail("XSD parse returned null document.", null, null);
            schema = parsed;
        }
        catch (XmlException xex)
        {
            return Fail($"Malformed XML: {xex.Message}", xex.LineNumber, xex.LinePosition);
        }
        catch (XmlSchemaException sex)
        {
            return Fail($"Invalid schema: {sex.Message}", sex.LineNumber, sex.LinePosition);
        }
        catch (Exception ex)
        {
            return Fail($"Failed to read XSD: {ex.Message}", null, null);
        }

        if (string.IsNullOrEmpty(schema.TargetNamespace))
            return Fail("XSD has empty targetNamespace — cannot register.", null, null);

        // Compile — catches deeper structural errors that pass initial
        // parsing (missing element declarations, cyclic includes, …).
        try
        {
            var set = new XmlSchemaSet { XmlResolver = null };
            set.Add(schema);
            set.Compile();
        }
        catch (XmlSchemaException sex)
        {
            return Fail($"Schema compile failed: {sex.Message}", sex.LineNumber, sex.LinePosition);
        }

        var mxType = ExtractMessageType(schema.TargetNamespace);
        var subDir = ResolveFamilyDirectory(mxType);
        var targetDir = subDir is null
            ? _registry.SchemasPath
            : Path.Combine(_registry.SchemasPath, subDir);

        // Overwrite policy — delete any pre-existing entry with the
        // same namespace so a re-upload with a different filename
        // doesn't leave orphans behind.
        Directory.CreateDirectory(targetDir);
        RemoveExistingWithNamespace(schema.TargetNamespace);

        var targetPath = Path.Combine(targetDir, safeName);
        // Atomic write: write to .tmp then move over — avoids the
        // registry seeing a half-written file if Reload races with us.
        var tmpPath = targetPath + ".tmp";
        File.WriteAllBytes(tmpPath, content);
        if (File.Exists(targetPath)) File.Delete(targetPath);
        File.Move(tmpPath, targetPath);

        // Reload synchronously so the same request can hand the new
        // schema back to the caller via the response body. Order matters:
        // SchemaRegistry is the source of truth (raw XSDs on disk) so it
        // must reload first; ReferenceService re-derives its extracted
        // field maps from the registry and has to run after.
        _registry.Reload();
        _referenceService?.Reload();

        return new SchemaUploadResult(
            Success: true,
            FileName: safeName,
            MessageType: mxType,
            Namespace: schema.TargetNamespace,
            Error: null,
            LineNumber: null,
            LinePosition: null);
    }

    private static SchemaUploadResult Fail(string message, int? line, int? position) =>
        new(Success: false, FileName: null, MessageType: null, Namespace: null,
            Error: message, LineNumber: line, LinePosition: position);

    /// <summary>Deletes any *.xsd under the schemas root whose target namespace matches.</summary>
    private void RemoveExistingWithNamespace(string targetNamespace)
    {
        if (!Directory.Exists(_registry.SchemasPath)) return;
        // Materialise the list first — modifying the directory while a
        // lazy enumerator is walking it produces undefined behaviour on
        // some file systems.
        var files = Directory.EnumerateFiles(
            _registry.SchemasPath, "*.xsd", SearchOption.AllDirectories).ToList();
        foreach (var file in files)
        {
            string? existingNs;
            try
            {
                // Read + dispose the handle in the same statement — a
                // `using` scope would still be holding the file open
                // when File.Delete runs a few lines below.
                using (var stream = File.OpenRead(file))
                {
                    existingNs = XmlSchema.Read(stream, static (_, _) => { })
                        ?.TargetNamespace;
                }
            }
            catch
            {
                // Corrupt on-disk XSD — skip, don't let it block upload.
                continue;
            }

            if (existingNs == targetNamespace)
            {
                try { File.Delete(file); }
                catch { /* another process holds it — best effort */ }
            }
        }
    }

    /// <summary>Message type = the tail after <c>urn:iso:std:iso:20022:tech:xsd:</c>.</summary>
    private static string? ExtractMessageType(string ns)
    {
        const string prefix = "urn:iso:std:iso:20022:tech:xsd:";
        return ns.StartsWith(prefix, StringComparison.Ordinal)
            ? ns[prefix.Length..]
            : null;
    }

    /// <summary>
    /// Picks the family subdirectory (<c>camt</c>, <c>pacs</c>, <c>pain</c>,
    /// <c>head</c>) from a canonical message type so the on-disk layout
    /// keeps mirroring the standard grouping. Non-standard namespaces
    /// land straight in the schemas root.
    /// </summary>
    private static string? ResolveFamilyDirectory(string? messageType)
    {
        if (string.IsNullOrEmpty(messageType)) return null;
        var dot = messageType.IndexOf('.');
        return dot > 0 ? messageType[..dot] : null;
    }
}
