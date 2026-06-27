using Iso8583Toolkit.Iso20022.Pix;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

/// <summary>
/// Pix QR Code (EMV-MPM) endpoints — decode/generate Copia-e-Cola payloads,
/// validate TXIDs and analyse Pix keys. Backed by
/// <see cref="PixQrCodeService"/>; every endpoint is stateless.
/// </summary>
[ApiController]
[Route("api/pix")]
public sealed class PixController(PixQrCodeService service) : ControllerBase
{
    public sealed record DecodeRequest(string Payload);
    public sealed record GenerateResponse(string Payload);
    public sealed record TxIdValidateRequest(string TxId);
    public sealed record TxIdGenerateResponse(string TxId);
    public sealed record KeyAnalyzeRequest(string Key);

    [HttpPost("qrcode/decode")]
    [EndpointSummary("Decode a Pix Copia-e-Cola payload")]
    [ProducesResponseType<PixDecodeResult>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public IActionResult Decode([FromBody] DecodeRequest request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Payload))
            return BadRequest(Problem("Payload is required."));
        return Ok(service.Decode(request.Payload));
    }

    [HttpPost("qrcode/generate")]
    [EndpointSummary("Generate a Pix Copia-e-Cola payload")]
    [ProducesResponseType<GenerateResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public IActionResult Generate([FromBody] PixGenerateRequest request)
    {
        if (request is null)
            return BadRequest(Problem("Request body is required."));
        try
        {
            return Ok(new GenerateResponse(service.Generate(request)));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(Problem(ex.Message));
        }
    }

    [HttpPost("txid/validate")]
    [EndpointSummary("Validate a Pix TXID format")]
    [ProducesResponseType<PixTxIdValidationResult>(StatusCodes.Status200OK)]
    public IActionResult ValidateTxId([FromBody] TxIdValidateRequest request)
        => Ok(service.ValidateTxId(request?.TxId));

    [HttpGet("txid/generate")]
    [EndpointSummary("Generate a fresh 26-char Pix TXID")]
    [ProducesResponseType<TxIdGenerateResponse>(StatusCodes.Status200OK)]
    public IActionResult GenerateTxId()
        => Ok(new TxIdGenerateResponse(service.GenerateTxId()));

    [HttpPost("key/analyze")]
    [EndpointSummary("Detect Pix key type (EVP, EMAIL, PHONE, CPF, CNPJ)")]
    [ProducesResponseType<PixKeyAnalysis>(StatusCodes.Status200OK)]
    public IActionResult AnalyzeKey([FromBody] KeyAnalyzeRequest request)
        => Ok(service.AnalyzePixKey(request?.Key));

    private static ProblemDetails Problem(string detail) => new()
    {
        Title = "Pix request error",
        Detail = detail,
        Status = StatusCodes.Status400BadRequest,
    };
}
