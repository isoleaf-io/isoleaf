using Iso8583Toolkit.Iso20022.TestData;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Backend.Controllers;

/// <summary>
/// On-demand payment fixtures (person, company, Pix key) backed by
/// <see cref="PaymentTestDataGenerator"/>. Used by the Builder and
/// QR Code Pix pages to populate forms with fresh fake-but-realistic
/// data each time the user clicks "↺ Dados de teste".
/// </summary>
[ApiController]
[Route("api/test-data")]
public sealed class TestDataController(PaymentTestDataGenerator generator) : ControllerBase
{
    [HttpGet("person")]
    [EndpointSummary("Generate a fake person (name, CPF, email, Pix phone)")]
    [ProducesResponseType<PersonData>(StatusCodes.Status200OK)]
    public ActionResult<PersonData> GetPerson([FromQuery] string locale = "pt_BR")
        => Ok(generator.GeneratePerson(locale));

    [HttpGet("company")]
    [EndpointSummary("Generate a fake company (name, CNPJ)")]
    [ProducesResponseType<CompanyData>(StatusCodes.Status200OK)]
    public ActionResult<CompanyData> GetCompany([FromQuery] string locale = "pt_BR")
        => Ok(generator.GenerateCompany(locale));

    [HttpGet("pix-key")]
    [EndpointSummary("Generate a fake Pix key (email, phone, CPF or EVP)")]
    [ProducesResponseType<PixKeyData>(StatusCodes.Status200OK)]
    public ActionResult<PixKeyData> GetPixKey() => Ok(generator.GeneratePixKey());

    /// <summary>
    /// Returns a Pix-compatible city — Latin-only ASCII, upper-case,
    /// truncated to 15 chars (EMV-MPM tag 60 limit). Used by the
    /// QR Code Pix form's "↺ Dados de teste" button.
    /// </summary>
    [HttpGet("city")]
    [EndpointSummary("Generate a Pix-compatible city name (≤15 chars, ASCII upper)")]
    [ProducesResponseType<string>(StatusCodes.Status200OK)]
    public ActionResult<string> GetCity([FromQuery] string locale = "pt_BR")
        => Ok(generator.GenerateCity(locale));
}
