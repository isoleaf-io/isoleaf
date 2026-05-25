namespace Iso8583Toolkit.Cards.Luhn;

public static class LuhnAlgorithm
{
    /// <summary>
    /// Validates whether a PAN passes the Luhn check.
    /// </summary>
    public static bool Validate(string pan)
    {
        if (string.IsNullOrWhiteSpace(pan) || pan.Length < 2)
            return false;

        var sum = 0;
        var alternate = false;

        for (var i = pan.Length - 1; i >= 0; i--)
        {
            if (!char.IsAsciiDigit(pan[i]))
                return false;

            var digit = pan[i] - '0';

            if (alternate)
            {
                digit *= 2;
                if (digit > 9)
                    digit -= 9;
            }

            sum += digit;
            alternate = !alternate;
        }

        return sum % 10 == 0;
    }

    /// <summary>
    /// Returns the Luhn check digit for the given partial PAN (without check digit).
    /// </summary>
    public static int GetCheckDigit(string panWithoutCheckDigit)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(panWithoutCheckDigit);

        var sum = 0;
        // With the check digit appended, the rightmost digit is the check digit (position 0, not doubled).
        // So the digits of panWithoutCheckDigit are processed starting from the rightmost,
        // and the first one (rightmost) IS doubled (because it will be at position 1 after appending check).
        var alternate = true;

        for (var i = panWithoutCheckDigit.Length - 1; i >= 0; i--)
        {
            if (!char.IsAsciiDigit(panWithoutCheckDigit[i]))
                throw new ArgumentException("PAN must contain only digits.", nameof(panWithoutCheckDigit));

            var digit = panWithoutCheckDigit[i] - '0';

            if (alternate)
            {
                digit *= 2;
                if (digit > 9)
                    digit -= 9;
            }

            sum += digit;
            alternate = !alternate;
        }

        return (10 - (sum % 10)) % 10;
    }

    /// <summary>
    /// Appends the Luhn check digit to the partial PAN and returns the complete PAN.
    /// </summary>
    public static string Calculate(string panWithoutCheckDigit)
    {
        var checkDigit = GetCheckDigit(panWithoutCheckDigit);
        return panWithoutCheckDigit + checkDigit;
    }
}
