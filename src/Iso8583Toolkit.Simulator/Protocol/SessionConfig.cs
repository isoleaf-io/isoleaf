namespace Iso8583Toolkit.Simulator.Protocol;

public sealed record SessionConfig
{
    public string SessionId { get; init; } = Guid.NewGuid().ToString();
    public int TcpPort { get; init; } = 8583;
    public SimulatorMode Mode { get; init; } = SimulatorMode.Rebatedor;
    public SimulatorRole Role { get; init; } = SimulatorRole.Adquirente;
    public string LayoutName { get; init; } = "default";
    public string? DefaultResponseCode { get; init; } = "00";
    public bool ValidateArqc { get; init; }
    public bool AutoRespond { get; init; } = true;
    public ResponseRules? Rules { get; init; }
    public int TimeoutMs { get; init; } = 30000;
    public string? IssuerMasterKey { get; init; }
    public string? Pan { get; init; }
    public string? PanSequenceNumber { get; init; }

    // Injetor mode: remote endpoint the agent should connect to.
    public string? TargetHost { get; init; }
    public int? TargetPort { get; init; }

    // Wire framing
    public int HeaderSize { get; init; } = 2;          // 2 or 4 byte big-endian length prefix

    /// <summary>
    /// Deprecated: use <see cref="TpduMode"/>. Kept for backwards compatibility —
    /// when <see cref="TpduMode"/> is <see cref="Protocol.TpduMode.Auto"/> and
    /// this is non-null, this value wins.
    /// </summary>
    public bool? UseTpdu { get; init; }

    /// <summary>
    /// How the session handles TPDU prefixes. Defaults to
    /// <see cref="Protocol.TpduMode.Optional"/> — accept both, mirror inbound
    /// format on the response.
    /// </summary>
    public TpduMode TpduMode { get; init; } = TpduMode.Optional;

    /// <summary>
    /// What the simulator should do when an inbound MTI is not in
    /// <see cref="ResponseRules.MtiResponseMap"/>. Defaults to <see cref="UnknownMtiResponse.Derive"/>.
    /// </summary>
    public UnknownMtiResponse UnknownMtiResponse { get; init; } = UnknownMtiResponse.Derive;

    /// <summary>
    /// Literal MTI returned when <see cref="UnknownMtiResponse"/> is
    /// <see cref="UnknownMtiResponse.Custom"/>. Ignored otherwise.
    /// </summary>
    public string? UnknownMtiCustomValue { get; init; }

    /// <summary>
    /// How the Issuer-role simulator handles Bit 55 in responses. Defaults
    /// to <see cref="EmvResponseMode.Echo"/> — copy the incoming value
    /// verbatim, which works for any payload shape including networks that
    /// prepend a proprietary header before the TLV body.
    /// </summary>
    public EmvResponseConfig EmvResponse { get; init; } = EmvResponseConfig.Default;

    /// <summary>
    /// Resolves whether the response should carry a TPDU, given the mode and
    /// whether the inbound message actually had one.
    /// </summary>
    public bool EffectiveUseTpdu(bool messageHasTpdu) => TpduMode switch
    {
        TpduMode.Required => true,
        TpduMode.Optional => messageHasTpdu,
        TpduMode.Strip => false,
        TpduMode.Auto => UseTpdu ?? SimulatorRoleProfile.DefaultUseTpdu(Role),
        _ => false,
    };

    /// <summary>Legacy overload kept so existing callers compile. Assumes the
    /// inbound message has TPDU — matches old Auto semantics.</summary>
    public bool EffectiveUseTpdu() => EffectiveUseTpdu(messageHasTpdu: true);
}
