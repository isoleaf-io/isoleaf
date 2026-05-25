namespace Iso8583Toolkit.Simulator.Responder;

public static class ResponseCodeHelper
{
    private static readonly Dictionary<string, string> Descriptions = new()
    {
        ["00"] = "Approved",
        ["01"] = "Refer to card issuer",
        ["03"] = "Invalid merchant",
        ["04"] = "Capture card",
        ["05"] = "Do not honor",
        ["06"] = "Error",
        ["08"] = "Honor with identification",
        ["10"] = "Partial approval",
        ["12"] = "Invalid transaction",
        ["13"] = "Invalid amount",
        ["14"] = "Invalid card number",
        ["19"] = "Re-enter transaction",
        ["25"] = "Unable to locate record on file",
        ["30"] = "Format error",
        ["41"] = "Lost card",
        ["43"] = "Stolen card",
        ["51"] = "Insufficient funds",
        ["54"] = "Expired card",
        ["55"] = "Incorrect PIN",
        ["57"] = "Transaction not permitted to cardholder",
        ["58"] = "Transaction not permitted to terminal",
        ["61"] = "Exceeds withdrawal amount limit",
        ["65"] = "Exceeds withdrawal frequency limit",
        ["75"] = "Allowable number of PIN tries exceeded",
        ["76"] = "Invalid/nonexistent 'To Account'",
        ["77"] = "Invalid/nonexistent 'From Account'",
        ["78"] = "Invalid/nonexistent account specified",
        ["80"] = "Visa transactions: credit issuer unavailable",
        ["81"] = "PIN cryptographic error found",
        ["82"] = "Negative CAM, dCVV, iCVV, or CVV results",
        ["85"] = "No reason to decline",
        ["91"] = "Authorization system or issuer system inoperative",
        ["92"] = "Unable to route transaction",
        ["94"] = "Duplicate transmission detected",
        ["96"] = "System error"
    };

    public static string GetDescription(string rc) =>
        Descriptions.GetValueOrDefault(rc, $"Unknown ({rc})");

    public static bool IsApproved(string rc) =>
        rc is "00" or "08" or "10" or "85";

    public static string GenerateAuthCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        return string.Create(6, chars, static (span, c) =>
        {
            for (var i = 0; i < span.Length; i++)
                span[i] = c[Random.Shared.Next(c.Length)];
        });
    }
}
