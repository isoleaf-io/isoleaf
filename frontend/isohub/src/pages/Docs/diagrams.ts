/**
 * Static inline SVG diagrams used by the docs. Shared between locales — the
 * markup is identical, only the surrounding prose differs. Authored by hand;
 * never accept user input through these strings (they are embedded with
 * dangerouslySetInnerHTML by DocBlocks.tsx).
 */

export const MESSAGE_STRUCTURE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 100"
     style="max-width:640px;width:100%;font-family:monospace">
  <!-- TPDU — slate (optional, dashed border) -->
  <rect x="10" y="10" width="90" height="60" rx="6"
        fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5"
        stroke-dasharray="6,3"/>
  <text x="55" y="33" text-anchor="middle" font-size="11" font-weight="bold" fill="#475569">TPDU</text>
  <text x="55" y="48" text-anchor="middle" font-size="10" fill="#64748b">5 bytes</text>
  <text x="55" y="62" text-anchor="middle" font-size="9"  fill="#94a3b8">(opcional)</text>

  <text x="107" y="45" font-size="14" fill="#94a3b8">→</text>

  <!-- MTI — blue -->
  <rect x="118" y="10" width="80" height="60" rx="6"
        fill="#dbeafe" stroke="#93c5fd" stroke-width="1.5"/>
  <text x="158" y="33" text-anchor="middle" font-size="11" font-weight="bold" fill="#1e40af">MTI</text>
  <text x="158" y="48" text-anchor="middle" font-size="10" fill="#1e3a8a">4 chars</text>
  <text x="158" y="62" text-anchor="middle" font-size="9"  fill="#3b82f6">ex: 0200</text>

  <text x="205" y="45" font-size="14" fill="#94a3b8">→</text>

  <!-- Bitmap — purple -->
  <rect x="218" y="10" width="130" height="60" rx="6"
        fill="#ede9fe" stroke="#c4b5fd" stroke-width="1.5"/>
  <text x="283" y="33" text-anchor="middle" font-size="11" font-weight="bold" fill="#5b21b6">Bitmap(s)</text>
  <text x="283" y="48" text-anchor="middle" font-size="10" fill="#4c1d95">8 ou 16 bytes</text>
  <text x="283" y="62" text-anchor="middle" font-size="9"  fill="#7c3aed">primário ± secundário</text>

  <text x="355" y="45" font-size="14" fill="#94a3b8">→</text>

  <!-- Data Elements — green -->
  <rect x="368" y="10" width="262" height="60" rx="6"
        fill="#dcfce7" stroke="#86efac" stroke-width="1.5"/>
  <text x="499" y="33" text-anchor="middle" font-size="11" font-weight="bold" fill="#14532d">Campos (Data Elements)</text>
  <text x="499" y="48" text-anchor="middle" font-size="10" fill="#166534">tamanho variável</text>
  <text x="499" y="62" text-anchor="middle" font-size="9"  fill="#16a34a">apenas os bits ativos no bitmap</text>

  <!-- Legend for the dashed border -->
  <text x="55" y="85" text-anchor="middle" font-size="8" fill="#94a3b8">tracejado = opcional</text>
</svg>
`.trim();

export const TPDU_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 90"
     style="max-width:540px;width:100%;font-family:monospace">
  <!-- Outer frame -->
  <rect x="10" y="10" width="520" height="50" rx="6"
        fill="none" stroke="#94a3b8" stroke-width="1.5"/>

  <!-- Byte 1: protocol ID -->
  <rect x="10" y="10" width="80" height="50" rx="0"
        fill="#dbeafe" stroke="#94a3b8" stroke-width="1"/>
  <!-- Bytes 2-3: origin NII -->
  <rect x="90" y="10" width="160" height="50" rx="0"
        fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <!-- Bytes 4-5: destination NII -->
  <rect x="250" y="10" width="160" height="50" rx="0"
        fill="#fef9c3" stroke="#94a3b8" stroke-width="1"/>
  <!-- Trailing ISO message slice -->
  <rect x="410" y="10" width="120" height="50" rx="6"
        fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>

  <!-- Top labels -->
  <text x="50"  y="28" text-anchor="middle" font-size="10" fill="#1e40af">Protocol</text>
  <text x="170" y="28" text-anchor="middle" font-size="10" fill="#166534">Origin NII</text>
  <text x="330" y="28" text-anchor="middle" font-size="10" fill="#854d0e">Destination NII</text>
  <text x="470" y="28" text-anchor="middle" font-size="10" fill="#475569">ISO Message</text>

  <!-- Hex values -->
  <text x="50"  y="46" text-anchor="middle" font-size="13" font-weight="bold" fill="#1e3a8a">60</text>
  <text x="170" y="46" text-anchor="middle" font-size="13" font-weight="bold" fill="#14532d">0002</text>
  <text x="330" y="46" text-anchor="middle" font-size="13" font-weight="bold" fill="#713f12">0001</text>
  <text x="470" y="46" text-anchor="middle" font-size="13" font-weight="bold" fill="#334155">0200...</text>

  <!-- Bottom labels: size in bytes -->
  <text x="50"  y="75" text-anchor="middle" font-size="9" fill="#64748b">1 byte</text>
  <text x="170" y="75" text-anchor="middle" font-size="9" fill="#64748b">2 bytes</text>
  <text x="330" y="75" text-anchor="middle" font-size="9" fill="#64748b">2 bytes</text>
  <text x="470" y="75" text-anchor="middle" font-size="9" fill="#64748b">variable</text>
</svg>
`.trim();

export const EMV_BIT55_ORIGINS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 340"
     style="max-width:640px;width:100%;font-family:monospace">
  <!-- CHIP (personalization) — blue -->
  <rect x="10" y="10" width="195" height="155" rx="6"
        fill="#dbeafe" stroke="#93c5fd" stroke-width="1.5"/>
  <text x="107" y="28" text-anchor="middle" font-size="11" font-weight="bold" fill="#1e40af">CHIP DO CARTÃO</text>
  <text x="107" y="42" text-anchor="middle" font-size="9" fill="#3b82f6">(personalização)</text>
  <text x="22"  y="70"  font-size="10" fill="#1e3a8a">82    AIP</text>
  <text x="22"  y="86"  font-size="10" fill="#1e3a8a">8E    CVM List</text>
  <text x="22"  y="102" font-size="10" fill="#1e3a8a">9F08  App Version</text>
  <text x="22"  y="118" font-size="10" fill="#1e3a8a">5F28  Iss Country</text>
  <text x="107" y="150" text-anchor="middle" font-size="8" font-style="italic" fill="#3b82f6">gravados na personalização</text>

  <!-- TERMINAL — amber -->
  <rect x="220" y="10" width="200" height="155" rx="6"
        fill="#fef9c3" stroke="#fde047" stroke-width="1.5"/>
  <text x="320" y="28" text-anchor="middle" font-size="11" font-weight="bold" fill="#854d0e">TERMINAL</text>
  <text x="320" y="42" text-anchor="middle" font-size="9" fill="#a16207">(capacidades / config)</text>
  <text x="232" y="70"  font-size="10" fill="#713f12">9F33  Term Cap</text>
  <text x="232" y="86"  font-size="10" fill="#713f12">9F35  Term Type</text>
  <text x="232" y="102" font-size="10" fill="#713f12">9F1A  Term Country</text>
  <text x="232" y="118" font-size="10" fill="#713f12">9F66  TTQ</text>
  <text x="320" y="150" text-anchor="middle" font-size="8" font-style="italic" fill="#a16207">do equipamento físico</text>

  <!-- NEGOTIATED — purple -->
  <rect x="435" y="10" width="195" height="155" rx="6"
        fill="#ede9fe" stroke="#c4b5fd" stroke-width="1.5"/>
  <text x="532" y="28" text-anchor="middle" font-size="11" font-weight="bold" fill="#5b21b6">NEGOCIADOS</text>
  <text x="532" y="42" text-anchor="middle" font-size="9" fill="#7c3aed">(chip + terminal)</text>
  <text x="447" y="70"  font-size="10" fill="#4c1d95">95    TVR</text>
  <text x="447" y="86"  font-size="10" fill="#4c1d95">9A    Tx Date</text>
  <text x="447" y="102" font-size="10" fill="#4c1d95">9C    Tx Type</text>
  <text x="447" y="118" font-size="10" fill="#4c1d95">9F02  Amount</text>
  <text x="447" y="134" font-size="10" fill="#4c1d95">9F37  UN</text>
  <text x="532" y="158" text-anchor="middle" font-size="8" font-style="italic" fill="#7c3aed">durante a transação</text>

  <!-- Converging arrows down -->
  <line x1="107" y1="170" x2="295" y2="213" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="320" y1="170" x2="320" y2="213" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="532" y1="170" x2="345" y2="213" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="295,215 290,207 300,207" fill="#94a3b8"/>
  <polygon points="320,215 315,207 325,207" fill="#94a3b8"/>
  <polygon points="345,215 340,207 350,207" fill="#94a3b8"/>

  <!-- CHIP (per-transaction output) — green -->
  <rect x="160" y="218" width="320" height="112" rx="6"
        fill="#dcfce7" stroke="#86efac" stroke-width="1.5"/>
  <text x="320" y="236" text-anchor="middle" font-size="11" font-weight="bold" fill="#14532d">CHIP — POR TRANSAÇÃO</text>
  <text x="320" y="250" text-anchor="middle" font-size="9" fill="#16a34a">o chip computa a cada compra — prova o cartão</text>
  <text x="180" y="275" font-size="10" fill="#166534">9F26  ARQC  ← criptograma calculado</text>
  <text x="180" y="291" font-size="10" fill="#166534">9F27  CID   ← tipo (80 = ARQC)</text>
  <text x="180" y="307" font-size="10" fill="#166534">9F36  ATC   ← contador (sempre incrementa)</text>
  <text x="180" y="323" font-size="10" fill="#166534">9F10  IAD   ← dados internos do emissor</text>
</svg>
`.trim();

export const EMV_DERIVATION_CHAIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 540"
     style="max-width:560px;width:100%;font-family:monospace">
  <!-- Level 1: IMK — HSM emissor (blue) -->
  <rect x="80" y="10" width="400" height="70" rx="6"
        fill="#dbeafe" stroke="#93c5fd" stroke-width="1.5"/>
  <text x="280" y="32" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e40af">IMK — Issuer Master Key</text>
  <text x="280" y="50" text-anchor="middle" font-size="10" fill="#1e3a8a">32 bytes · nunca sai do HSM em produção</text>
  <text x="280" y="68" text-anchor="middle" font-size="9" font-style="italic" fill="#3b82f6">[ HSM do emissor ]</text>

  <line x1="280" y1="85" x2="280" y2="115" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="280,117 275,109 285,109" fill="#94a3b8"/>
  <text x="290" y="103" font-size="9" fill="#64748b">Derive(PAN, PAN Sequence Number)</text>

  <!-- Level 2: ICC MK — Chip (green) -->
  <rect x="80" y="120" width="400" height="70" rx="6"
        fill="#dcfce7" stroke="#86efac" stroke-width="1.5"/>
  <text x="280" y="142" text-anchor="middle" font-size="12" font-weight="bold" fill="#14532d">ICC MK — ICC Master Key</text>
  <text x="280" y="160" text-anchor="middle" font-size="10" fill="#166534">única por cartão · gravada na personalização</text>
  <text x="280" y="178" text-anchor="middle" font-size="9" font-style="italic" fill="#16a34a">[ chip do cartão ]</text>

  <line x1="280" y1="195" x2="280" y2="225" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="280,227 275,219 285,219" fill="#94a3b8"/>
  <text x="290" y="213" font-size="9" fill="#64748b">Derive(ATC)</text>

  <!-- Level 3: Session Key — per transaction (purple) -->
  <rect x="80" y="230" width="400" height="70" rx="6"
        fill="#ede9fe" stroke="#c4b5fd" stroke-width="1.5"/>
  <text x="280" y="252" text-anchor="middle" font-size="12" font-weight="bold" fill="#5b21b6">Session Key</text>
  <text x="280" y="270" text-anchor="middle" font-size="10" fill="#4c1d95">única por transação (ATC muda a cada vez)</text>
  <text x="280" y="288" text-anchor="middle" font-size="9" font-style="italic" fill="#7c3aed">[ tempo real — calculada pelo chip ]</text>

  <line x1="280" y1="305" x2="280" y2="335" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="280,337 275,329 285,329" fill="#94a3b8"/>
  <text x="290" y="323" font-size="9" fill="#64748b">CBC-MAC(Transaction Data — CDOL1)</text>

  <!-- Level 4: ARQC — message (amber) -->
  <rect x="80" y="340" width="400" height="70" rx="6"
        fill="#fef9c3" stroke="#fde047" stroke-width="1.5"/>
  <text x="280" y="362" text-anchor="middle" font-size="12" font-weight="bold" fill="#854d0e">ARQC — tag 9F26</text>
  <text x="280" y="380" text-anchor="middle" font-size="10" fill="#713f12">8 bytes · prova que o chip estava presente</text>
  <text x="280" y="398" text-anchor="middle" font-size="9" font-style="italic" fill="#a16207">[ mensagem ISO 8583 — Bit 55 ]</text>

  <line x1="280" y1="415" x2="280" y2="445" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="280,447 275,439 285,439" fill="#94a3b8"/>
  <text x="290" y="433" font-size="9" fill="#64748b">enviado → validado pelo emissor</text>

  <!-- Level 5: Validation — issuer (blue) -->
  <rect x="80" y="450" width="400" height="80" rx="6"
        fill="#dbeafe" stroke="#93c5fd" stroke-width="1.5"/>
  <text x="280" y="472" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e40af">Validação no emissor</text>
  <text x="280" y="490" text-anchor="middle" font-size="10" fill="#1e3a8a">recalcula a cadeia com a IMK</text>
  <text x="280" y="508" text-anchor="middle" font-size="10" font-weight="bold" fill="#166534">ARQC calc = ARQC recebido → cartão autêntico</text>
  <text x="280" y="524" text-anchor="middle" font-size="9" font-style="italic" fill="#3b82f6">[ HSM do emissor ]</text>
</svg>
`.trim();

export const FOUR_LEGS_FLOW_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 160"
     style="max-width:800px;width:100%;font-family:monospace">
  <!-- Participants -->
  <!-- Terminal — slate -->
  <rect x="10" y="20" width="130" height="70" rx="6"
        fill="#f1f5f9" stroke="#475569" stroke-width="1.5"/>
  <text x="75" y="50" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e293b">Terminal / POS</text>
  <text x="75" y="68" text-anchor="middle" font-size="9" fill="#475569">captura o cartão</text>

  <!-- Acquirer — blue -->
  <rect x="230" y="20" width="130" height="70" rx="6"
        fill="#dbeafe" stroke="#1e40af" stroke-width="1.5"/>
  <text x="295" y="50" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e40af">Adquirente</text>
  <text x="295" y="68" text-anchor="middle" font-size="9" fill="#1e3a8a">credenciadora</text>

  <!-- Brand — purple -->
  <rect x="450" y="20" width="130" height="70" rx="6"
        fill="#ede9fe" stroke="#5b21b6" stroke-width="1.5"/>
  <text x="515" y="50" text-anchor="middle" font-size="12" font-weight="bold" fill="#5b21b6">Bandeira</text>
  <text x="515" y="68" text-anchor="middle" font-size="9" fill="#4c1d95">rede de pagamento</text>

  <!-- Issuer — green -->
  <rect x="670" y="20" width="120" height="70" rx="6"
        fill="#dcfce7" stroke="#166534" stroke-width="1.5"/>
  <text x="730" y="50" text-anchor="middle" font-size="12" font-weight="bold" fill="#166534">Emissor</text>
  <text x="730" y="68" text-anchor="middle" font-size="9" fill="#14532d">autoriza ou recusa</text>

  <!-- Leg 1: Terminal → Acquirer (gap 140-230) -->
  <line x1="142" y1="45" x2="223" y2="45" stroke="#475569" stroke-width="1.5"/>
  <polygon points="228,45 220,41 220,49" fill="#475569"/>
  <text x="183" y="39" text-anchor="middle" font-size="10" fill="#1e293b">0200 →</text>
  <line x1="223" y1="70" x2="147" y2="70" stroke="#475569" stroke-width="1.5"/>
  <polygon points="142,70 150,66 150,74" fill="#475569"/>
  <text x="183" y="84" text-anchor="middle" font-size="10" fill="#1e293b">← 0210</text>
  <text x="183" y="113" text-anchor="middle" font-size="10" font-weight="bold" fill="#334155">Perna 1</text>
  <text x="183" y="128" text-anchor="middle" font-size="9" fill="#64748b">Protocolo proprietário</text>
  <text x="183" y="142" text-anchor="middle" font-size="9" fill="#64748b">TPDU opcional</text>

  <!-- Leg 2: Acquirer → Brand (gap 360-450) -->
  <line x1="362" y1="45" x2="443" y2="45" stroke="#475569" stroke-width="1.5"/>
  <polygon points="448,45 440,41 440,49" fill="#475569"/>
  <text x="403" y="39" text-anchor="middle" font-size="10" fill="#1e293b">0200 →</text>
  <line x1="443" y1="70" x2="367" y2="70" stroke="#475569" stroke-width="1.5"/>
  <polygon points="362,70 370,66 370,74" fill="#475569"/>
  <text x="403" y="84" text-anchor="middle" font-size="10" fill="#1e293b">← 0210</text>
  <text x="403" y="113" text-anchor="middle" font-size="10" font-weight="bold" fill="#334155">Perna 2</text>
  <text x="403" y="128" text-anchor="middle" font-size="9" fill="#64748b">Protocolo da bandeira</text>
  <text x="403" y="142" text-anchor="middle" font-size="9" fill="#64748b">TPDU obrigatório</text>

  <!-- Leg 3: Brand → Issuer (gap 580-670) -->
  <line x1="582" y1="45" x2="663" y2="45" stroke="#475569" stroke-width="1.5"/>
  <polygon points="668,45 660,41 660,49" fill="#475569"/>
  <text x="625" y="39" text-anchor="middle" font-size="10" fill="#1e293b">0200 →</text>
  <line x1="663" y1="70" x2="587" y2="70" stroke="#475569" stroke-width="1.5"/>
  <polygon points="582,70 590,66 590,74" fill="#475569"/>
  <text x="625" y="84" text-anchor="middle" font-size="10" fill="#1e293b">← 0210</text>
  <text x="625" y="113" text-anchor="middle" font-size="10" font-weight="bold" fill="#334155">Perna 3</text>
  <text x="625" y="128" text-anchor="middle" font-size="9" fill="#64748b">Protocolo da bandeira</text>
  <text x="625" y="142" text-anchor="middle" font-size="9" fill="#64748b">TPDU obrigatório</text>
</svg>
`.trim();

/**
 * Pix credit-transfer flow — same visual family as FOUR_LEGS_FLOW_SVG:
 * rounded-rect actors, per-actor colour scheme (fill + stroke of the
 * same hue), 12px bold labels + 9px muted subtitles, slate arrows with
 * triangular polygon heads, and a "forward + return" arrow pair per leg
 * with a bold leg label + two-line caption below.
 *
 * Palette choices:
 *   PSP Pagador     — blue   (initiator, matches Acquirer blue in FOUR_LEGS)
 *   SPI / BCB       — green  (central authority, matches Issuer green)
 *   PSP Recebedor   — purple (destination, matches Brand purple)
 */
export const PIX_CREDIT_TRANSFER_FLOW_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 160"
     style="max-width:720px;width:100%;font-family:monospace">
  <!-- PSP Pagador — blue -->
  <rect x="10" y="20" width="170" height="70" rx="6"
        fill="#dbeafe" stroke="#1e40af" stroke-width="1.5"/>
  <text x="95" y="50" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e40af">PSP Pagador</text>
  <text x="95" y="68" text-anchor="middle" font-size="9" fill="#1e3a8a">banco do pagador</text>

  <!-- SPI / BCB — green (central authority) -->
  <rect x="270" y="20" width="170" height="70" rx="6"
        fill="#dcfce7" stroke="#166534" stroke-width="1.5"/>
  <text x="355" y="50" text-anchor="middle" font-size="12" font-weight="bold" fill="#166534">SPI / BCB</text>
  <text x="355" y="68" text-anchor="middle" font-size="9" fill="#14532d">liquidação em tempo real</text>

  <!-- PSP Recebedor — purple -->
  <rect x="530" y="20" width="170" height="70" rx="6"
        fill="#ede9fe" stroke="#5b21b6" stroke-width="1.5"/>
  <text x="615" y="50" text-anchor="middle" font-size="12" font-weight="bold" fill="#5b21b6">PSP Recebedor</text>
  <text x="615" y="68" text-anchor="middle" font-size="9" fill="#4c1d95">banco do recebedor</text>

  <!-- Envio: PSP Pagador → SPI (gap 180-270) -->
  <line x1="182" y1="45" x2="263" y2="45" stroke="#475569" stroke-width="1.5"/>
  <polygon points="268,45 260,41 260,49" fill="#475569"/>
  <text x="225" y="39" text-anchor="middle" font-size="10" fill="#1e293b">pacs.008 →</text>
  <line x1="263" y1="70" x2="187" y2="70" stroke="#475569" stroke-width="1.5"/>
  <polygon points="182,70 190,66 190,74" fill="#475569"/>
  <text x="225" y="84" text-anchor="middle" font-size="10" fill="#1e293b">← pacs.002</text>
  <text x="225" y="113" text-anchor="middle" font-size="10" font-weight="bold" fill="#334155">Envio</text>
  <text x="225" y="128" text-anchor="middle" font-size="9" fill="#64748b">Instrução de crédito</text>
  <text x="225" y="142" text-anchor="middle" font-size="9" fill="#64748b">Confirmação (ACSC)</text>

  <!-- Repasse: SPI → PSP Recebedor (gap 440-530) -->
  <line x1="442" y1="45" x2="523" y2="45" stroke="#475569" stroke-width="1.5"/>
  <polygon points="528,45 520,41 520,49" fill="#475569"/>
  <text x="485" y="39" text-anchor="middle" font-size="10" fill="#1e293b">pacs.008 →</text>
  <line x1="523" y1="70" x2="447" y2="70" stroke="#475569" stroke-width="1.5"/>
  <polygon points="442,70 450,66 450,74" fill="#475569"/>
  <text x="485" y="84" text-anchor="middle" font-size="10" fill="#1e293b">← pacs.002</text>
  <text x="485" y="113" text-anchor="middle" font-size="10" font-weight="bold" fill="#334155">Repasse</text>
  <text x="485" y="128" text-anchor="middle" font-size="9" fill="#64748b">Instrução ao recebedor</text>
  <text x="485" y="142" text-anchor="middle" font-size="9" fill="#64748b">Confirmação (ACSC)</text>
</svg>
`.trim();

/**
 * SWIFT MT103 direct-payment flow — mirrors PIX_CREDIT_TRANSFER_FLOW_SVG
 * layout and reuses the same rectangles/arrows/typography so both fit as
 * a pair. Colour choices intentionally differ per role to hint the
 * different family without breaking the visual system:
 *   Banco Ordenante     — blue  (initiator)
 *   SWIFT               — slate (neutral network, matches Terminal slate in FOUR_LEGS)
 *   Banco Beneficiário  — green (destination)
 */
export const MT103_DIRECT_FLOW_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 160"
     style="max-width:720px;width:100%;font-family:monospace">
  <!-- Banco Ordenante — blue -->
  <rect x="10" y="20" width="170" height="70" rx="6"
        fill="#dbeafe" stroke="#1e40af" stroke-width="1.5"/>
  <text x="95" y="50" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e40af">Banco Ordenante</text>
  <text x="95" y="68" text-anchor="middle" font-size="9" fill="#1e3a8a">Debtor Agent</text>

  <!-- SWIFT — slate (neutral network) -->
  <rect x="270" y="20" width="170" height="70" rx="6"
        fill="#f1f5f9" stroke="#475569" stroke-width="1.5"/>
  <text x="355" y="50" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e293b">SWIFT</text>
  <text x="355" y="68" text-anchor="middle" font-size="9" fill="#475569">rede de mensageria</text>

  <!-- Banco Beneficiário — green -->
  <rect x="530" y="20" width="170" height="70" rx="6"
        fill="#dcfce7" stroke="#166534" stroke-width="1.5"/>
  <text x="615" y="50" text-anchor="middle" font-size="12" font-weight="bold" fill="#166534">Banco Beneficiário</text>
  <text x="615" y="68" text-anchor="middle" font-size="9" fill="#14532d">Creditor Agent</text>

  <!-- Envio: Ordenante → SWIFT (gap 180-270) -->
  <line x1="182" y1="45" x2="263" y2="45" stroke="#475569" stroke-width="1.5"/>
  <polygon points="268,45 260,41 260,49" fill="#475569"/>
  <text x="225" y="39" text-anchor="middle" font-size="10" fill="#1e293b">MT103 →</text>
  <line x1="263" y1="70" x2="187" y2="70" stroke="#475569" stroke-width="1.5"/>
  <polygon points="182,70 190,66 190,74" fill="#475569"/>
  <text x="225" y="84" text-anchor="middle" font-size="10" fill="#1e293b">← ACK</text>
  <text x="225" y="113" text-anchor="middle" font-size="10" font-weight="bold" fill="#334155">Envio</text>
  <text x="225" y="128" text-anchor="middle" font-size="9" fill="#64748b">Instrução de crédito</text>
  <text x="225" y="142" text-anchor="middle" font-size="9" fill="#64748b">Ack de recebimento</text>

  <!-- Entrega: SWIFT → Beneficiário (gap 440-530) -->
  <line x1="442" y1="45" x2="523" y2="45" stroke="#475569" stroke-width="1.5"/>
  <polygon points="528,45 520,41 520,49" fill="#475569"/>
  <text x="485" y="39" text-anchor="middle" font-size="10" fill="#1e293b">MT103 →</text>
  <line x1="523" y1="70" x2="447" y2="70" stroke="#475569" stroke-width="1.5"/>
  <polygon points="442,70 450,66 450,74" fill="#475569"/>
  <text x="485" y="84" text-anchor="middle" font-size="10" fill="#1e293b">← ACK</text>
  <text x="485" y="113" text-anchor="middle" font-size="10" font-weight="bold" fill="#334155">Entrega</text>
  <text x="485" y="128" text-anchor="middle" font-size="9" fill="#64748b">Roteamento à rede</text>
  <text x="485" y="142" text-anchor="middle" font-size="9" fill="#64748b">Ack de entrega</text>
</svg>
`.trim();

export const ISOHUB_ARCHITECTURE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 820 640"
  style="max-width:820px;width:100%;font-family:system-ui,sans-serif;background:transparent">
  <defs>
    <marker id="arr-blue" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0,8 3,0 6" fill="#3b82f6"/>
    </marker>
    <marker id="arr-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0,8 3,0 6" fill="#16a34a"/>
    </marker>
    <marker id="arr-orange" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0,8 3,0 6" fill="#ea580c"/>
    </marker>
    <marker id="arr-gray" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0,8 3,0 6" fill="#64748b"/>
    </marker>
    <marker id="arr-gray-start" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto-start-reverse">
      <polygon points="0 0,8 3,0 6" fill="#64748b"/>
    </marker>
  </defs>

  <!-- Máquina do usuário (fundo externo) — abriga também Terminal e Sistema externo -->
  <rect x="8" y="8" width="620" height="624" rx="14"
    fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="10,4"/>
  <text x="22" y="28" font-size="11" fill="#94a3b8" font-weight="500"
    letter-spacing="0.5">SUA MÁQUINA</text>

  <!-- Docker container -->
  <rect x="28" y="38" width="580" height="410" rx="10"
    fill="#eff6ff" stroke="#93c5fd" stroke-width="1.5"/>
  <!-- Badge Docker -->
  <rect x="28" y="38" width="110" height="24" rx="5" fill="#2563eb"/>
  <text x="83" y="54" font-size="11" fill="white" font-weight="700"
    text-anchor="middle">🐳 Docker</text>

  <!-- Agent -->
  <rect x="50" y="74" width="536" height="148" rx="8"
    fill="#dbeafe" stroke="#60a5fa" stroke-width="1.5"/>
  <text x="318" y="96" font-size="13" fill="#1e40af"
    text-anchor="middle" font-weight="700">ISOLeaf Agent</text>
  <text x="318" y="112" font-size="10" fill="#3b82f6"
    text-anchor="middle">ASP.NET Core 9 · porta 8080</text>

  <!-- REST API — expanded to 3 lines to include the ISO 20022 route families -->
  <rect x="70" y="120" width="336" height="90" rx="6"
    fill="white" stroke="#93c5fd" stroke-width="1"/>
  <text x="238" y="140" font-size="11" fill="#1d4ed8"
    text-anchor="middle" font-weight="600">REST API</text>
  <text x="238" y="158" font-size="9" fill="#3b82f6"
    text-anchor="middle">/api/parse · /api/build · /api/emv · /api/cards · /api/simulator</text>
  <text x="238" y="172" font-size="9" fill="#3b82f6"
    text-anchor="middle">/api/iso20022/* · /api/pix/* · /api/swift/* · /api/iso8583/flow</text>
  <text x="238" y="186" font-size="9" fill="#3b82f6"
    text-anchor="middle">/api/workspace · /api/health · /api/config · /api/test-data</text>
  <text x="238" y="202" font-size="8.5" fill="#64748b"
    text-anchor="middle" font-style="italic">17 controllers · OpenAPI em /api/docs (Scalar)</text>

  <!-- SignalR — matched height (90) for row alignment -->
  <rect x="424" y="120" width="142" height="90" rx="6"
    fill="white" stroke="#93c5fd" stroke-width="1"/>
  <text x="495" y="142" font-size="11" fill="#1d4ed8"
    text-anchor="middle" font-weight="600">SignalR Hub</text>
  <text x="495" y="160" font-size="9" fill="#3b82f6"
    text-anchor="middle">WebSocket</text>
  <text x="495" y="174" font-size="9" fill="#3b82f6"
    text-anchor="middle">log ao vivo</text>
  <text x="495" y="188" font-size="9" fill="#3b82f6"
    text-anchor="middle">Simulador</text>
  <text x="495" y="202" font-size="8.5" fill="#64748b"
    text-anchor="middle" font-style="italic">/hubs/simulator</text>

  <!-- Seta Agent → Frontend -->
  <line x1="318" y1="222" x2="318" y2="246"
    stroke="#60a5fa" stroke-width="1.5" marker-end="url(#arr-blue)"/>

  <!-- Frontend -->
  <rect x="50" y="246" width="536" height="58" rx="8"
    fill="#f3e8ff" stroke="#c084fc" stroke-width="1.5"/>
  <text x="318" y="272" font-size="13" fill="#6b21a8"
    text-anchor="middle" font-weight="700">ISOLeaf Frontend</text>
  <text x="318" y="288" font-size="9" fill="#9333ea"
    text-anchor="middle">React · TypeScript · Vite · Tailwind CSS (servido como arquivos estáticos pelo Agent)</text>

  <!-- Seta Frontend → Libs -->
  <line x1="318" y1="304" x2="318" y2="326"
    stroke="#a78bfa" stroke-width="1.5" marker-end="url(#arr-blue)"/>

  <!-- Bibliotecas — 4 caixas ISO 8583 na linha 1 -->
  <rect x="50" y="326" width="120" height="44" rx="6"
    fill="#dcfce7" stroke="#86efac" stroke-width="1.3"/>
  <text x="110" y="344" font-size="10" fill="#14532d"
    text-anchor="middle" font-weight="600">IsoCore</text>
  <text x="110" y="358" font-size="8.5" fill="#16a34a"
    text-anchor="middle">Parser · Builder · Bitmap</text>

  <rect x="184" y="326" width="126" height="44" rx="6"
    fill="#dcfce7" stroke="#86efac" stroke-width="1.3"/>
  <text x="247" y="344" font-size="10" fill="#14532d"
    text-anchor="middle" font-weight="600">Cryptography</text>
  <text x="247" y="358" font-size="8.5" fill="#16a34a"
    text-anchor="middle">ARQC · ARPC · TLV · 3DES</text>

  <rect x="324" y="326" width="110" height="44" rx="6"
    fill="#dcfce7" stroke="#86efac" stroke-width="1.3"/>
  <text x="379" y="344" font-size="10" fill="#14532d"
    text-anchor="middle" font-weight="600">Cards</text>
  <text x="379" y="358" font-size="8.5" fill="#16a34a"
    text-anchor="middle">PAN · CVV · Trilhas</text>

  <rect x="448" y="326" width="138" height="44" rx="6"
    fill="#dcfce7" stroke="#86efac" stroke-width="1.3"/>
  <text x="517" y="344" font-size="10" fill="#14532d"
    text-anchor="middle" font-weight="600">Simulator</text>
  <text x="517" y="358" font-size="8.5" fill="#16a34a"
    text-anchor="middle">TcpListener · TcpClient</text>

  <!-- Bibliotecas — linha 2: novo bloco Iso20022 ocupando full width -->
  <rect x="50" y="380" width="536" height="52" rx="6"
    fill="#dcfce7" stroke="#86efac" stroke-width="1.3"/>
  <text x="318" y="400" font-size="10" fill="#14532d"
    text-anchor="middle" font-weight="600">Iso8583Toolkit.Iso20022</text>
  <text x="318" y="416" font-size="8.5" fill="#16a34a"
    text-anchor="middle">Parser · Builder · Referência · Validador · Comparador · Pix · SWIFT MT · Flows</text>
  <text x="318" y="428" font-size="8" fill="#166534"
    text-anchor="middle" font-style="italic">SchemaRegistry (44 XSDs — camt/head/pacs/pain) · recarrega ao upload</text>

  <!-- Storage local — ganhou 3ª linha para /app/data/schemas -->
  <rect x="50" y="452" width="536" height="54" rx="6"
    fill="#fefce8" stroke="#fde047" stroke-width="1"/>
  <text x="318" y="468" font-size="9.5" fill="#713f12"
    text-anchor="middle">💾 Armazenamento local: Workspace (JSON) · Templates (localStorage) · Sessões TCP (memória)</text>
  <text x="318" y="482" font-size="9" fill="#713f12"
    text-anchor="middle">📁 /app/data/schemas — XSDs ISO 20022 (pré-carregados na imagem, graváveis via upload)</text>
  <text x="318" y="498" font-size="8.5" fill="#92400e"
    text-anchor="middle" font-style="italic">Volume Docker opcional: -v isoleaf-schemas:/app/data/schemas (persiste uploads entre updates)</text>

  <!-- Portas TCP do Simulador -->
  <rect x="50" y="516" width="536" height="32" rx="6"
    fill="#fff1f2" stroke="#fca5a5" stroke-width="1"/>
  <text x="318" y="536" font-size="9" fill="#9f1239"
    text-anchor="middle">🔌 Portas TCP abertas pelo Simulador: configuradas pelo usuário (ex: 9100, 8583...)</text>

  <!-- Browser -->
  <rect x="664" y="38" width="148" height="60" rx="8"
    fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5"/>
  <text x="738" y="62" font-size="20" text-anchor="middle">🖥️</text>
  <text x="738" y="82" font-size="11" fill="#334155"
    text-anchor="middle" font-weight="600">Browser</text>

  <!-- Seta Browser ↔ Agent -->
  <line x1="664" y1="68" x2="612" y2="120"
    stroke="#64748b" stroke-width="1.5" stroke-dasharray="5,3"
    marker-start="url(#arr-gray-start)" marker-end="url(#arr-gray)"/>
  <text x="650" y="103" font-size="9" fill="#475569"
    text-anchor="middle" transform="rotate(-40,650,103)">HTTP :8080</text>

  <!-- Terminal/POS — moved down to y=572 to sit below Simulador ports -->
  <rect x="28" y="572" width="164" height="52" rx="8"
    fill="#fff7ed" stroke="#fb923c" stroke-width="1.5"/>
  <text x="110" y="594" font-size="18" text-anchor="middle">📟</text>
  <text x="110" y="612" font-size="10" fill="#c2410c"
    text-anchor="middle" font-weight="600">Terminal / POS</text>

  <!-- Seta Terminal → Simulador (Rebatedor) -->
  <line x1="190" y1="582" x2="280" y2="550"
    stroke="#ea580c" stroke-width="1.5"
    marker-end="url(#arr-orange)"/>
  <text x="220" y="565" font-size="9" fill="#c2410c"
    text-anchor="middle">TCP · Rebatedor</text>

  <!-- Sistema externo — moved down to y=572 -->
  <rect x="460" y="572" width="168" height="52" rx="8"
    fill="#fef2f2" stroke="#f87171" stroke-width="1.5"/>
  <text x="544" y="594" font-size="18" text-anchor="middle">🖧</text>
  <text x="544" y="612" font-size="10" fill="#991b1b"
    text-anchor="middle" font-weight="600">Sistema externo</text>

  <!-- Seta Simulador → Sistema (Injetor) -->
  <line x1="400" y1="550" x2="470" y2="582"
    stroke="#16a34a" stroke-width="1.5"
    marker-end="url(#arr-green)"/>
  <text x="450" y="565" font-size="9" fill="#166534"
    text-anchor="middle">TCP · Injetor</text>

  <!-- Legenda — inalterada; Iso20022 reusa a cor "Bibliotecas (.NET)" -->
  <rect x="664" y="130" width="148" height="144" rx="8"
    fill="white" stroke="#e2e8f0" stroke-width="1"/>
  <text x="738" y="150" font-size="10" fill="#475569"
    text-anchor="middle" font-weight="600">LEGENDA</text>
  <rect x="676" y="160" width="12" height="12" rx="3" fill="#dbeafe" stroke="#60a5fa"/>
  <text x="696" y="171" font-size="9" fill="#334155">Agent (ASP.NET Core)</text>
  <rect x="676" y="180" width="12" height="12" rx="3" fill="#f3e8ff" stroke="#c084fc"/>
  <text x="696" y="191" font-size="9" fill="#334155">Frontend (React)</text>
  <rect x="676" y="200" width="12" height="12" rx="3" fill="#dcfce7" stroke="#86efac"/>
  <text x="696" y="211" font-size="9" fill="#334155">Bibliotecas (.NET)</text>
  <rect x="676" y="220" width="12" height="12" rx="3" fill="#fefce8" stroke="#fde047"/>
  <text x="696" y="231" font-size="9" fill="#334155">Armazenamento local</text>
  <rect x="676" y="240" width="12" height="12" rx="3" fill="#eff6ff" stroke="#93c5fd"
    stroke-dasharray="4,2"/>
  <text x="696" y="251" font-size="9" fill="#334155">Docker container</text>
  <rect x="676" y="260" width="12" height="12" rx="3" fill="#f8fafc" stroke="#cbd5e1"
    stroke-dasharray="6,3"/>
  <text x="696" y="271" font-size="9" fill="#334155">Máquina local</text>
</svg>
`.trim();
