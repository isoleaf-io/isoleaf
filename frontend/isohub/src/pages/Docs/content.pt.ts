import type { DocSection } from "./types";
import { TPDU_SVG, MESSAGE_STRUCTURE_SVG, EMV_BIT55_ORIGINS_SVG, EMV_DERIVATION_CHAIN_SVG, FOUR_LEGS_FLOW_SVG, ISOHUB_ARCHITECTURE_SVG } from "./diagrams";

/** Long-form documentation in Portuguese. Mirrored by content.en.ts. */
export const DOCS_PT: Record<string, DocSection> = {
  iso8583: {
    id: "iso8583",
    blocks: [
      // ── 1. O que é o ISO 8583 ─────────────────────────────────────────
      { type: "heading", level: 2, text: "O que é o ISO 8583" },
      {
        type: "paragraph",
        text:
          "ISO/IEC 8583 é o padrão internacional que define a estrutura, os campos e a codificação das mensagens eletrônicas trocadas em transações com cartão de pagamento — autorizações, financeiras, reversões, gerenciamento de rede e administrativas.",
      },
      {
        type: "paragraph",
        text:
          "É a linguagem comum entre terminais/POS, adquirentes, bandeiras e emissores: cada participante envia e recebe mensagens nesse formato, em ambas as direções do fluxo (requisição e resposta).",
      },
      {
        type: "paragraph",
        text:
          "O padrão NÃO define o protocolo de transporte (TCP, X.25, SNA, etc.) — apenas o formato da mensagem em si. Cada rede escolhe como enquadrar e transportar essas mensagens; é por isso que aspectos como TPDU, framing por tamanho ou STX/ETX são definidos por cada bandeira/rede, não pelo ISO 8583.",
      },

      // ── 2. Estrutura ──────────────────────────────────────────────────
      { type: "heading", level: 2, text: "Estrutura de uma mensagem" },
      {
        type: "paragraph",
        text:
          "Uma mensagem completa pode ter até 3 partes: TPDU (opcional, de transporte) + MTI + Bitmap(s) + Campos de dados. O TPDU é amplamente usado em redes TCP/IP mas não faz parte do padrão ISO 8583 propriamente dito.",
      },
      { type: "svg", text: MESSAGE_STRUCTURE_SVG },

      // ── 3. TPDU ───────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "TPDU — Transport Protocol Data Unit" },
      {
        type: "callout",
        tone: "info",
        text:
          "O TPDU não é parte do padrão ISO 8583. É um cabeçalho de roteamento adicionado pelo protocolo de transporte de cada rede (Visa, Mastercard, redes adquirentes). Nem todas as implementações usam TPDU.",
      },
      {
        type: "paragraph",
        text:
          "Quando presente, são 5 bytes (10 chars hex) prefixando a mensagem ISO 8583. Usado para roteamento TCP entre participantes da rede — diz ao concentrador quem envia e quem deve receber.",
      },
      {
        type: "table",
        headers: ["Bytes", "Campo", "Tamanho", "Exemplo"],
        rows: [
          ["Byte 1", "ID do protocolo", "1 byte", "60"],
          ["Bytes 2-3", "NII de origem", "2 bytes", "0002"],
          ["Bytes 4-5", "NII de destino", "2 bytes", "0001"],
        ],
      },
      { type: "svg", text: TPDU_SVG },
      {
        type: "paragraph",
        text:
          "NII (Network Interface Identifier) é um identificador atribuído pela bandeira a cada participante da rede. Exemplo completo: 6000020001 → protocolo 0x60, origem 0002, destino 0001.",
      },

      // ── 4. MTI ────────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "MTI — Message Type Indicator" },
      {
        type: "paragraph",
        text:
          "4 dígitos numéricos que identificam o tipo da mensagem. Cada dígito tem um significado posicional específico — leia da esquerda para a direita.",
      },
      {
        type: "table",
        headers: ["Dígito", "Nome", "Valores"],
        rows: [
          ["1", "Versão", "0 = ISO 8583:1987 · 1 = ISO 8583:1993 · 2 = ISO 8583:2003"],
          ["2", "Classe", "1 = Autorização · 2 = Financeira · 4 = Reversão · 8 = Rede"],
          ["3", "Função", "0 = Requisição · 1 = Resposta · 2 = Aviso · 3 = Resposta de aviso"],
          ["4", "Origem", "0 = Adquirente · 2 = Emissor · 4 = Outros"],
        ],
      },
      { type: "heading", level: 3, text: "MTIs mais comuns" },
      {
        type: "table",
        headers: ["MTI", "Nome", "Uso típico"],
        rows: [
          ["0100", "Authorization Request", "Pré-autorização (sem débito)"],
          ["0110", "Authorization Response", "Resposta à pré-autorização"],
          ["0200", "Financial Request", "Débito imediato (compra, saque)"],
          ["0210", "Financial Response", "Resposta à transação financeira"],
          ["0400", "Reversal Request", "Estorno / reversão de transação"],
          ["0410", "Reversal Response", "Confirmação de reversão"],
          ["0420", "Reversal Advice", "Aviso de reversão (sem resposta aguardada)"],
          ["0800", "Network Management Request", "Echo test, sign-on / sign-off"],
          ["0810", "Network Management Response", "Resposta ao network management"],
        ],
      },

      // ── 5. Bitmap ─────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "Bitmap — mapa de campos presentes" },
      {
        type: "paragraph",
        text:
          "O bitmap é uma sequência de bits onde cada bit indica se o campo correspondente está presente na mensagem. Bit 1 = presente; bit 0 = ausente.",
      },
      {
        type: "list",
        items: [
          "Bitmap primário: 8 bytes (64 bits) → indica os campos 1 a 64.",
          "Bitmap secundário: 8 bytes (64 bits) → indica os campos 65 a 128.",
          "O bitmap secundário só aparece quando o bit 1 do bitmap primário está ligado.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "O bit 1 do bitmap NÃO representa um campo de dados — é o flag que indica se o bitmap secundário está presente. Por isso o primeiro campo de dados real começa no bit 2 (PAN).",
      },
      { type: "heading", level: 3, text: "Como ler o bitmap byte a byte" },
      {
        type: "code",
        text:
`Bitmap hex:  F2 3C 24 81 28 C0 82 00
Bitmap bin:  11110010 00111100 00100100 10000001
             00101000 11000000 10000010 00000000
             │└──┬──┘ └──┬───┘ └──┬───┘ └──┬───┘
             │  bits     bits     bits     bits
             │  2-8      9-16    17-24    25-32
             │
             └─ bit 1: bitmap secundário presente? (=1, sim)

Lendo cada bit da esquerda para a direita:
  Bit 1  = 1 → bitmap secundário presente (campos 65-128 podem existir)
  Bit 2  = 1 → campo 2 (PAN) presente
  Bit 3  = 1 → campo 3 (Processing Code) presente
  Bit 4  = 1 → campo 4 (Amount, Transaction) presente
  Bit 5  = 0 → campo 5 ausente
  Bit 6  = 0 → campo 6 ausente
  Bit 7  = 1 → campo 7 (Transmission DateTime) presente
  Bit 8  = 0 → campo 8 ausente
  ... e assim por diante até o bit 64`,
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Para ler manualmente: converta cada par hex para binário (ex.: F2 → 11110010). O bit mais significativo (MSB) de cada byte corresponde ao menor número de campo daquele grupo de 8.",
      },

      // ── 6. Data Elements ──────────────────────────────────────────────
      { type: "heading", level: 2, text: "Campos (Data Elements)" },
      {
        type: "paragraph",
        text:
          "Cada campo tem: número (1-128), nome, tipo de encoding (como o conteúdo é codificado), tipo de comprimento (fixo ou variável) e tamanho máximo.",
      },
      { type: "heading", level: 3, text: "Tipos de encoding" },
      {
        type: "table",
        headers: ["Tipo", "Significado", "Exemplo"],
        rows: [
          ["n", "Numérico (0-9)", `"000001"`],
          ["a", "Alfabético (A-Z, espaço)", `"COMPRA"`],
          ["an", "Alfanumérico", `"LOJA01"`],
          ["ans", "Alfanumérico + especial", `"LOJA/01"`],
          ["b", "Binário", "bytes raw"],
          ["z", "Trilha magnética", `"4111=2512"`],
          ["x+n", "Sinal (C/D) + numérico", `"C000000010000"`],
        ],
      },
      { type: "heading", level: 3, text: "Tipos de comprimento" },
      {
        type: "table",
        headers: ["Tipo", "Significado"],
        rows: [
          ["FIXED", "Tamanho fixo, sempre igual"],
          ["LLVAR", "2 dígitos de comprimento + valor (max 99)"],
          ["LLLVAR", "3 dígitos de comprimento + valor (max 999)"],
        ],
      },
      {
        type: "code",
        text:
`Exemplo LLVAR — campo 35 (Track 2) com valor "4111111111111111=2512":

  20 4111111111111111=2512
  ┬─ ─────────────────────
  │           valor (20 caracteres)
  │
  └ comprimento "20" em 2 dígitos`,
      },

      // ── 7. Campos mais importantes ────────────────────────────────────
      { type: "heading", level: 2, text: "Campos mais importantes" },
      {
        type: "paragraph",
        text:
          "Os campos a seguir aparecem na maioria das transações e são essenciais para entender qualquer mensagem ISO 8583 — o ISOLeaf também os destaca no Builder e no Parser.",
      },

      { type: "heading", level: 3, text: "Bit 2 — PAN (Primary Account Number)" },
      {
        type: "paragraph",
        text:
          "Tipo: LLVAR n, máx 19 dígitos. O número do cartão. Os primeiros 6-8 dígitos formam o BIN, que identifica o emissor e a bandeira. Sempre mascarado na exibição (ex.: 636368******4970).",
      },

      { type: "heading", level: 3, text: "Bit 3 — Processing Code" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 6. Seis dígitos divididos em 3 subcampos de 2 dígitos cada — descrevem o que a transação faz, de qual conta e para qual conta.",
      },
      {
        type: "table",
        headers: ["Posição", "Subcampo", "Valores comuns"],
        rows: [
          ["1-2", "Tipo de transação", "00 = Compra · 01 = Saque · 20 = Devolução · 30 = Consulta"],
          ["3-4", "Conta debitada (from)", "00 = Default · 10 = Poupança · 20 = Corrente · 30 = Crédito"],
          ["5-6", "Conta creditada (to)", "00 = Default · 10 = Poupança · 20 = Corrente · 30 = Crédito"],
        ],
      },
      {
        type: "code",
        text:
`Exemplos:
  003000 → Compra crédito  (00 = compra, 30 = crédito, 00 = default)
  012020 → Saque à vista   (01 = saque,  20 = corrente, 20 = corrente)
  203000 → Devolução / estorno de compra crédito`,
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Os subcampos 3-4 e 5-6 não são universais — cada bandeira/adquirente pode usar combinações próprias. Visa, Mastercard e Elo, por exemplo, divergem em alguns valores para débito à vista vs. parcelado e para crédito vs. débito de poupança. Sempre consulte o catálogo de processing codes do parceiro com quem você integra.",
      },

      { type: "heading", level: 3, text: "Bit 4 — Amount, Transaction" },
      {
        type: "paragraph",
        text: `Tipo: FIXED n 12. Valor da transação em centavos, sem separador decimal. Ex.: 000000018233 = R$ 182,33.`,
      },

      { type: "heading", level: 3, text: "Bit 7 — Transmission Date & Time" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 10. Formato MMDDHHmmss (mês, dia, hora, minuto, segundo) em UTC. Ex.: 0522104642 = 22 de maio, 10:46:42.",
      },

      { type: "heading", level: 3, text: "Bit 11 — STAN (Systems Trace Audit Number)" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 6. Número sequencial da transação gerado pelo terminal. Único por terminal por dia. Usado para rastreamento e para correlacionar requisição e resposta. Ex.: 000042.",
      },

      { type: "heading", level: 3, text: "Bit 22 — POS Entry Mode" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 3. Como o cartão foi lido pelo terminal. Diferente do conceito de \"canal\" — o canal é uma abstração da aplicação; o POS Entry Mode é o que o terminal efetivamente reportou.",
      },
      {
        type: "table",
        headers: ["Valor", "Canal", "Descrição"],
        rows: [
          ["010", "Manual / digitado", "PAN digitado no teclado"],
          ["021", "Tarja magnética", "Leitura da trilha"],
          ["051", "Chip (EMV)", "Contato no chip, dados validados"],
          ["071", "Contactless / NFC", "Aproximação do cartão ou celular"],
          ["090", "Tarja (fallback de chip)", "Chip não-leu, caiu para tarja"],
          ["801", "Tarja, sem CVV", "Fallback sem PIN"],
        ],
      },

      { type: "heading", level: 3, text: "Bit 35 — Track 2 Data" },
      {
        type: "paragraph",
        text:
          "Tipo: LLVAR z, máx 37 chars. Dados da faixa 2 da tarja magnética. Formato: PAN=AAMM[Service Code][Dados discricionários]. Ex.: 4111111111111111=25121011234567890. O separador \"=\" divide o PAN dos dados de serviço (D na trilha real, convertido para = na transmissão).",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "O Track 2 contém dados sensíveis do cartão. Nunca armazene ou transmita sem criptografia / tokenização (PCI DSS).",
      },

      { type: "heading", level: 3, text: "Bit 37 — RRN (Retrieval Reference Number)" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED an 12. Número de referência único atribuído pelo adquirente. Usado para identificar a transação em estornos, chargebacks e conciliação. Deve ser único por dia.",
      },

      { type: "heading", level: 3, text: "Bit 38 — Authorization ID Response" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED an 6. Código de autorização retornado pelo emissor quando a transação é aprovada. Ex.: \"123456\". Presente apenas na resposta (0110 / 0210).",
      },

      { type: "heading", level: 3, text: "Bit 39 — Response Code" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED an 2. Resultado da autorização. \"00\" = aprovado; demais valores indicam o motivo da recusa.",
      },
      {
        type: "table",
        headers: ["RC", "Significado"],
        rows: [
          ["00", "Aprovado"],
          ["05", "Não autorizado (genérico)"],
          ["12", "Transação inválida"],
          ["14", "PAN inválido"],
          ["41", "Cartão perdido"],
          ["43", "Cartão roubado"],
          ["51", "Saldo insuficiente"],
          ["54", "Cartão vencido"],
          ["55", "PIN incorreto"],
          ["57", "Transação não permitida ao portador"],
          ["62", "Cartão com restrição"],
          ["91", "Emissor indisponível"],
        ],
      },

      { type: "heading", level: 3, text: "Bit 41 — Terminal ID" },
      { type: "paragraph", text: "Tipo: FIXED ans 8. Identificador único do terminal cadastrado no adquirente." },

      { type: "heading", level: 3, text: "Bit 42 — Merchant ID" },
      { type: "paragraph", text: "Tipo: FIXED ans 15. Identificador único do estabelecimento comercial." },

      { type: "heading", level: 3, text: "Bit 49 — Currency Code, Transaction" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 3. Código ISO 4217 da moeda da transação. 986 = BRL (Real brasileiro), 840 = USD, 978 = EUR.",
      },

      { type: "heading", level: 3, text: "Bit 52 — PIN Data" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED b 8. PIN Block criptografado (8 bytes = 16 hex chars) no formato ISO 9564. Criptografado com a ZPK (Zone PIN Key) acordada entre adquirente e bandeira.",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "O PIN Block é dado ultrassensível. Nunca exibir em texto claro. O ISOLeaf exibe sempre como ******** (mascarado).",
      },

      { type: "heading", level: 3, text: "Bit 55 — ICC Data (EMV)" },
      {
        type: "paragraph",
        text:
          "Tipo: LLLVAR b, máx 255 bytes. Dados do chip EMV no formato BER-TLV. Contém o ARQC (criptograma do chip), ATC, TVR, AIP e dezenas de outras tags. Veja a seção \"EMV & Criptografia\" para detalhes completos.",
      },

      { type: "heading", level: 3, text: "Bit 90 — Original Data Elements" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 42. Presente apenas em reversões (MTI 04xx). Contém os dados da transação original empacotados: MTI original (4) + STAN (6) + DateTime (10) + RRN (12) + zeros até completar 42.",
      },

      // ── 8. Mensagem completa comentada ────────────────────────────────
      { type: "heading", level: 2, text: "Exemplo de mensagem completa" },
      {
        type: "paragraph",
        text:
          "Para fixar como tudo se encadeia, segue um exemplo comentado de uma 0200 (financial request, compra crédito chip) com TPDU. Cada linha do exemplo é uma fatia da wire ASCII real.",
      },
      {
        type: "code",
        text:
`Wire completa:
6000020001 0200 F23C248128C08200 16 4111111111111111 003000 000000018233 0522104642 000042 ...

Quebrada parte a parte:

  6000020001                       ← TPDU (5 bytes / 10 hex)
    60       protocolo
    0002     NII origem (adquirente)
    0001     NII destino (bandeira)

  0200                             ← MTI (Financial Request)

  F23C248128C08200                 ← Bitmap primário (8 bytes)
    bit 1 = 1 → tem bitmap secundário? (este exemplo não tem,
                bit 1 está 0; F2 = 11110010)
    bits 2,3,4,7,11,12,...        → campos presentes

  16 4111111111111111              ← Bit 2 — PAN (LLVAR)
    "16" = comprimento, depois 16 dígitos do PAN

  003000                           ← Bit 3 — Processing Code
    00 = compra · 30 = crédito · 00 = default

  000000018233                     ← Bit 4 — Amount (12 dígitos)
    R$ 182,33

  0522104642                       ← Bit 7 — Transmission DateTime
    22/maio 10:46:42 UTC

  000042                           ← Bit 11 — STAN
    42ª transação do terminal no dia

  ...                              ← demais campos seguem na ordem
                                     do bitmap (12, 13, 14, 22, 35, 37,
                                     41, 42, 49, 52, 55 ...)`,
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "O exemplo acima é didático — os espaços e comentários são apenas para leitura. Para testar no Parser, use uma mensagem ISO 8583 real gerada pelo Builder (sem espaços, sem comentários). O Parser aceita ASCII wire e binary-hex sem separadores.",
      },

      // ── 9. Formatos de wire ───────────────────────────────────────────
      { type: "heading", level: 2, text: "Formatos de wire" },
      {
        type: "paragraph",
        text:
          "O ISOLeaf suporta automaticamente dois formatos de transmissão da mesma mensagem ISO 8583:",
      },
      {
        type: "table",
        headers: ["Formato", "Descrição", "Exemplo (início)"],
        rows: [
          ["ASCII wire", "Campos representados como texto ASCII", `"0200F23C...NJJZ3Z"`],
          ["Binary-hex", "Bytes em hexadecimal (cada byte = 2 chars)", `"30323030463233..."`],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "ASCII wire e binary-hex são apenas encodings diferentes da mesma mensagem ISO 8583. O Parser do ISOLeaf detecta automaticamente qual formato foi colado — você não precisa indicar.",
      },
      {
        type: "code",
        text:
`Mesmo MTI "0200" em três representações:

  ASCII wire:    0200          (4 chars ASCII; bytes na wire: 30 32 30 30)
  Binary-hex:    30323030      (hex dos bytes ASCII acima — 8 chars)
  Binário puro:  02 00         (2 bytes binários — NÃO é ASCII;
                                 raro em ISO 8583, comum em EMV TLV)`,
      },
    ],
  },

  emv: {
    id: "emv",
    blocks: [
      // ── 1. O que é EMV ───────────────────────────────────────────────
      { type: "heading", level: 2, text: "O que é EMV" },
      {
        type: "paragraph",
        text:
          "Padrão global (Europay, Mastercard, Visa) para transações com chip. Define a comunicação entre chip e terminal e os mecanismos criptográficos que autenticam cada transação.",
      },
      {
        type: "paragraph",
        text:
          "Diferente do ISO 8583 (que define a mensagem de rede), o EMV define o que acontece ANTES da mensagem ser enviada: a geração dos dados de segurança pelo chip do cartão.",
      },

      // ── 2. O Bit 55 — de onde vêm os dados ──────────────────────────
      { type: "heading", level: 2, text: "O Bit 55 — de onde vêm os dados" },
      {
        type: "paragraph",
        text:
          "O Bit 55 é uma composição de dados de três origens distintas. É importante entender isso para saber o que pode ser manipulado em testes.",
      },
      { type: "svg", text: EMV_BIT55_ORIGINS_SVG },

      { type: "heading", level: 3, text: "Dados do chip (personalização)" },
      {
        type: "paragraph",
        text:
          "Tags que o emissor gravou no chip quando emitiu o cartão. Definem as capacidades e configurações do cartão. O ISOLeaf gera valores realistas para estas quando você usa o Builder com canal Chip.",
      },
      { type: "heading", level: 3, text: "Dados do terminal" },
      {
        type: "paragraph",
        text:
          "Tags que o terminal adiciona ao Bit 55. Descrevem as capacidades físicas do equipamento. Os valores dependem de como o terminal foi configurado.",
      },
      { type: "heading", level: 3, text: "Dados negociados" },
      {
        type: "paragraph",
        text:
          "Tags cujos valores resultam da interação chip-terminal durante a transação (antes do ARQC ser calculado). O TVR (Terminal Verification Results), por exemplo, registra o resultado de cada verificação realizada.",
      },
      { type: "heading", level: 3, text: "Dados gerados pelo chip por transação" },
      {
        type: "paragraph",
        text:
          "O ARQC (tag 9F26) é calculado pelo chip a cada transação. O ATC (tag 9F36) incrementa a cada transação — nunca se repete. São os dados que provam que o chip físico estava presente.",
      },

      // ── 3. Estrutura BER-TLV ────────────────────────────────────────
      { type: "heading", level: 2, text: "Estrutura BER-TLV" },
      {
        type: "paragraph",
        text:
          "O Bit 55 usa BER-TLV (Basic Encoding Rules — Tag Length Value), um padrão de codificação derivado do ASN.1.",
      },
      { type: "paragraph", text: "Cada elemento TLV tem 3 partes:" },
      {
        type: "table",
        headers: ["Parte", "Tamanho", "Descrição"],
        rows: [
          ["TAG", "1-2 bytes", "Identifica o campo. Se bits 4-0 = 11111, o próximo byte é parte da tag."],
          ["LENGTH", "1-3 bytes", "Short form: 1 byte (<128). Long form: 0x81+N ou 0x82+NN."],
          ["VALUE", "N bytes", "Conteúdo do campo."],
        ],
      },
      {
        type: "code",
        text:
`Bit 55 (hex): 9F 26 08 A1 B2 C3 D4 E5 F6 07 08 9F 36 02 00 1E

Decompondo:
  9F 26              ← TAG 9F26 (2 bytes, pois 9F = ...11111)
  08                 ← LENGTH = 8 bytes
  A1B2C3D4E5F60708   ← VALUE = ARQC (8 bytes)

  9F 36              ← TAG 9F36 (2 bytes)
  02                 ← LENGTH = 2 bytes
  00 1E              ← VALUE = ATC = 30 decimal (30ª transação)`,
      },
      {
        type: "callout",
        tone: "info",
        text:
          "O ISOLeaf monta e parseia BER-TLV automaticamente. Use Dados EMV → Parse Bit 55 para decompor qualquer Bit 55 em suas tags. O parse é parcial — se encontrar uma tag desconhecida, continua parseando as próximas.",
      },

      // ── 4. Tabela de tags ───────────────────────────────────────────
      { type: "heading", level: 2, text: "Tags mais importantes" },
      {
        type: "table",
        headers: ["Tag", "Nome", "Origem", "Tamanho", "Descrição"],
        rows: [
          ["9F26", "ARQC", "Chip/transação", "8 bytes", "Criptograma de autorização"],
          ["9F27", "CID", "Chip/transação", "1 byte", "Tipo de criptograma (80=ARQC)"],
          ["9F10", "IAD", "Chip/transação", "variável", "Dados internos do emissor"],
          ["9F36", "ATC", "Chip/transação", "2 bytes", "Contador de transações"],
          ["9F37", "UN", "Terminal", "4 bytes", "Número imprevisível"],
          ["9F02", "Amount", "Terminal", "6 bytes", "Valor autorizado"],
          ["9F03", "Amount Other", "Terminal", "6 bytes", "Valor adicional"],
          ["9A", "Tx Date", "Terminal", "3 bytes", "Data da transação (YYMMDD)"],
          ["9C", "Tx Type", "Terminal", "1 byte", "Tipo (00=compra, 01=saque)"],
          ["95", "TVR", "Negociado", "5 bytes", "Terminal Verification Results"],
          ["82", "AIP", "Chip", "2 bytes", "Application Interchange Profile"],
          ["9F33", "Term Cap", "Terminal", "3 bytes", "Capacidades do terminal"],
          ["8E", "CVM List", "Chip", "variável", "Lista de métodos de verificação"],
          ["9F34", "CVM Results", "Negociado", "3 bytes", "Resultado da verificação do portador"],
          ["9F35", "Term Type", "Terminal", "1 byte", "Tipo de terminal"],
          ["9F1A", "Term Country", "Terminal", "2 bytes", "País do terminal"],
        ],
      },

      // ── 5. Cadeia de derivação ──────────────────────────────────────
      { type: "heading", level: 2, text: "Cadeia de derivação EMV" },
      {
        type: "paragraph",
        text:
          "O ARQC não é mágico — é o último elo de uma cadeia de derivação de chaves que começa no HSM do emissor e termina como 8 bytes na mensagem ISO 8583.",
      },
      { type: "svg", text: EMV_DERIVATION_CHAIN_SVG },
      {
        type: "paragraph",
        text:
          "Cada nível usa o anterior + um dado específico da transação. Isso garante que a chave que calcula o ARQC seja única para AQUELA transação naquele cartão — qualquer replay é detectável pelo emissor.",
      },

      // ── 6. A IMK no ISOLeaf ──────────────────────────────────────────
      { type: "heading", level: 2, text: "A IMK no ISOLeaf" },
      { type: "heading", level: 3, text: "Por que o ISOLeaf usa a IMK?" },
      {
        type: "paragraph",
        text:
          "Em produção, a IMK fica protegida em um HSM (Hardware Security Module) do emissor — nunca é exposta em texto claro.",
      },
      { type: "paragraph", text: "O ISOLeaf usa a IMK para fins de desenvolvimento e testes:" },
      {
        type: "list",
        items: [
          "Builder: quando a IMK está configurada no Workspace, o Builder gera ARQC criptograficamente real em vez de um valor aleatório. O badge \"✓ ARQC derivado\" confirma isso.",
          "Validar ARQC: valida se um ARQC recebido é legítimo para uma determinada IMK e PAN. Útil para testar a integração do emissor.",
          "Full Flow: executa toda a cadeia IMK → ICC MK → Session Key → validação do ARQC → geração do ARPC em um único passo.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Use apenas IMKs de teste — nunca configure uma IMK de produção no ISOLeaf ou em qualquer ferramenta de desenvolvimento. Em produção, a IMK só deve existir dentro de um HSM certificado.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Para configurar a IMK: Workspace → Chaves criptográficas → Issuer Master Key (32 hex chars).",
      },

      // ── 7. ARPC ─────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "ARPC — Resposta do emissor" },
      {
        type: "paragraph",
        text:
          "Após validar o ARQC, o emissor calcula o ARPC para provar ao terminal que quem respondeu é realmente o emissor legítimo. O ARPC vai no Bit 55 da resposta (tag 91).",
      },
      {
        type: "table",
        headers: ["Método", "Fórmula", "Quando usar"],
        rows: [
          ["Method 1", "3DES(Session Key, ARQC XOR RC)", "Visa CVN 10/18, Elo"],
          ["Method 2", "MAC(Session Key, CSU || dados)", "Mastercard M/Chip"],
        ],
      },
      {
        type: "paragraph",
        text:
          "Onde RC = Response Code (2 bytes do bit 39: \"00\" = aprovado) e CSU = Card Status Update (4 bytes — permite atualizar o status do chip).",
      },

      // ── 8. Decodificadores em breve ─────────────────────────────────
      { type: "heading", level: 2, text: "Decodificadores de tags — em breve" },
      {
        type: "paragraph",
        text:
          "Algumas tags do Bit 55 são bitmaps onde cada bit tem um significado específico. O ISOLeaf planeja implementar decodificadores visuais para essas tags.",
      },
      { type: "heading", level: 3, text: "TVR (Tag 95) — Terminal Verification Results" },
      { type: "paragraph", text: "5 bytes = 40 bits, cada um indicando uma verificação:" },
      {
        type: "table",
        headers: ["Bit", "Posição", "Significado"],
        rows: [
          ["Bit 1",  "1.8", "Offline data auth não realizada"],
          ["Bit 2",  "1.7", "SDA falhou"],
          ["Bit 3",  "1.6", "ICC data missing"],
          ["Bit 4",  "1.5", "Cartão no exception file do terminal"],
          ["Bit 5",  "1.4", "DDA falhou"],
          ["Bit 6",  "1.3", "CDA falhou"],
          ["Bit 7",  "2.8", "ICC e terminal têm versões de app diferentes"],
          ["Bit 8",  "2.4", "PIN inválido digitado"],
          ["Bit 9",  "2.3", "PIN entry bypassed"],
          ["Bit 10", "3.8", "Limite offline de transações excedido"],
          ["Bit 11", "4.8", "Transação selecionada aleatoriamente p/ review"],
          ["Bit 12", "5.8", "Merchant forced transaction online"],
        ],
      },
      { type: "heading", level: 3, text: "AIP (Tag 82) — Application Interchange Profile" },
      { type: "paragraph", text: "2 bytes indicando o que o cartão suporta:" },
      {
        type: "table",
        headers: ["Bit", "Significado"],
        rows: [
          ["1.7", "SDA suportado"],
          ["1.6", "DDA suportado"],
          ["1.5", "Cardholder verification suportado"],
          ["1.4", "Terminal risk management exigido"],
          ["1.3", "Issuer authentication suportado"],
          ["1.1", "CDA suportado"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Os decodificadores de TVR, AIP, TTQ, CVM List e outras tags de bitmap estão no roadmap do ISOLeaf. Quando disponíveis, aparecerão automaticamente no módulo Dados EMV → Parse Bit 55.",
      },
    ],
  },

  roles: {
    id: "roles",
    blocks: [
      // ── 1. Participantes ─────────────────────────────────────────
      { type: "heading", level: 2, text: "Os participantes de uma transação" },
      { type: "heading", level: 3, text: "PORTADOR (Cardholder)" },
      { type: "paragraph", text: "O titular do cartão que realiza a compra." },
      { type: "heading", level: 3, text: "ESTABELECIMENTO (Merchant)" },
      { type: "paragraph", text: "O lojista que aceita o pagamento." },
      { type: "heading", level: 3, text: "TERMINAL / POS" },
      { type: "paragraph", text: "O equipamento que captura os dados do cartão e envia a mensagem ISO 8583 para o adquirente." },
      { type: "heading", level: 3, text: "ADQUIRENTE (Acquirer)" },
      {
        type: "paragraph",
        text:
          "A credenciadora que conecta o estabelecimento à rede. Recebe a mensagem do terminal e roteia para a bandeira. Exemplos: Cielo, Rede, Stone, GetNet.",
      },
      { type: "heading", level: 3, text: "BANDEIRA (Network/Brand)" },
      {
        type: "paragraph",
        text:
          "O operador da rede de pagamentos. Roteia a mensagem do adquirente para o emissor e define as regras de autorização. Exemplos: Visa, Mastercard, Elo, Amex.",
      },
      { type: "heading", level: 3, text: "EMISSOR (Issuer)" },
      {
        type: "paragraph",
        text:
          "O banco ou instituição que emitiu o cartão. Autoriza ou recusa a transação — verifica o ARQC, saldo, limite, etc. Exemplos: Itaú, Bradesco, Nubank.",
      },
      { type: "heading", level: 3, text: "PROCESSADORA (Processor)" },
      {
        type: "paragraph",
        text:
          "Em alguns modelos, a processadora fica entre a bandeira e o emissor — executa a autorização em nome do emissor. Comum em emissores menores que terceirizam o processamento.",
      },

      // ── 2. Fluxo de quatro pernas ────────────────────────────────
      { type: "heading", level: 2, text: "O fluxo de quatro pernas" },
      {
        type: "paragraph",
        text:
          "Uma transação completa atravessa até quatro participantes em sequência. Cada conexão entre dois deles é chamada de \"perna\" — e cada perna pode usar um protocolo de transporte diferente.",
      },
      { type: "svg", text: FOUR_LEGS_FLOW_SVG },
      {
        type: "paragraph",
        text:
          "Cada perna pode usar protocolos diferentes. O TPDU (Transport Protocol Data Unit) é tipicamente exigido nas pernas 2 e 3 (entre instituições financeiras), enquanto a perna 1 (terminal → adquirente) frequentemente usa protocolos proprietários sem TPDU.",
      },
      {
        type: "paragraph",
        text:
          "No fluxo de resposta, o ARPC calculado pelo emissor volta pelo mesmo caminho (Bandeira → Adquirente → Terminal). O terminal entrega o ARPC ao chip, que valida e aprova ou rejeita localmente.",
      },

      // ── 2b. Classes de mensagem ISO 8583 ────────────────────────
      { type: "heading", level: 2, text: "Classes de mensagem ISO 8583" },
      {
        type: "paragraph",
        text:
          "O segundo dígito do MTI define a CLASSE da mensagem. Entender essa distinção é fundamental para montar mensagens corretas e integrar com qualquer rede.",
      },
      {
        type: "table",
        headers: ["Classe", "MTIs", "Tipo", "Descrição"],
        rows: [
          ["1xx", "0100 / 0110 / 0120 / 0130", "Autorização", "Compras em estabelecimentos, consultas, pré-autorizações"],
          ["2xx", "0200 / 0210 / 0220 / 0230", "Financeiro", "Transações com movimentação financeira imediata (ATM, saques, depósitos)"],
          ["4xx", "0400 / 0410 / 0420 / 0430", "Reversão", "Cancelamento de uma transação anterior (1xx ou 2xx)"],
          ["8xx", "0800 / 0810 / 0820 / 0830", "Rede", "Echo test, sign-on / off, troca de chave, cutover"],
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Distinção crítica entre 0100 e 0200. 0100 — Autorização: o cliente passa o cartão em uma loja, farmácia, restaurante, posto de combustível… O emissor autoriza a operação; o débito efetivo ocorre depois, no processo de liquidação (clearing). 0200 — Financeiro: eventos de ATM (saque, depósito, troca de senha) — transações que movimentam a conta na hora, sem liquidação separada. Este é um dos erros mais comuns em integrações: usar 0200 para compra em loja ou 0100 para saque em ATM.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Redes proprietárias frequentemente definem MTIs customizados para funcionalidades que vão além do padrão ISO 8583, como extratos, pagamentos de contas e serviços específicos. Esses MTIs variam por rede e são definidos na especificação técnica de cada operador — consulte a documentação da rede com que está integrando. O ISOLeaf suporta MTIs customizados via configuração \"MTI desconhecido\" no Simulador.",
      },

      // ── 3. Modos de entrada ──────────────────────────────────────
      { type: "heading", level: 2, text: "Modo de entrada — como o cartão foi lido" },
      {
        type: "paragraph",
        text:
          "O Bit 22 (POS Entry Mode) informa como o cartão foi capturado. Isso muda completamente o que é esperado na mensagem.",
      },
      {
        type: "table",
        headers: ["Código", "Modo", "Bit 35", "Bit 52", "Bit 55", "Uso típico"],
        rows: [
          ["051", "Chip (ICC)", "Presente", "Opcional", "Presente", "Compra em loja com chip"],
          ["090", "Tarja magnética", "Presente", "Opcional", "Ausente", "Fallback para tarja"],
          ["071", "Contactless chip", "Presente", "Ausente", "Presente", "NFC / tap to pay"],
          ["075", "Contactless tarja", "Presente", "Ausente", "Ausente", "NFC sem chip"],
          ["010", "PAN manual (digitado)", "Ausente", "Ausente", "Ausente", "MOTO, call center"],
          ["081", "e-Commerce", "Ausente", "Ausente", "Ausente", "Compra online"],
          ["901", "Fallback (chip→tarja)", "Presente", "Ausente", "Ausente", "Chip defeituoso"],
        ],
      },

      { type: "heading", level: 3, text: "Diferenças técnicas por modo de entrada" },

      { type: "heading", level: 4, text: "Chip (051)" },
      {
        type: "paragraph",
        text:
          "O chip gera o ARQC usando a ICC Master Key derivada da IMK. O Bit 55 é obrigatório e contém o criptograma de autenticação. O emissor valida o ARQC para confirmar que o chip físico participou da transação — a principal proteção anti-fraude. O Bit 35 (Track 2) também é capturado do chip.",
      },

      { type: "heading", level: 4, text: "Tarja magnética (090)" },
      {
        type: "paragraph",
        text:
          "Sem criptograma — apenas os dados da tarja são enviados. O Bit 35 contém PAN + data de validade + service code + dados discricionários. Mais vulnerável a fraude — dados podem ser clonados. Em muitas redes, transações de tarja de cartões com chip são tratadas com mais suspeita (downgrade attack).",
      },

      { type: "heading", level: 4, text: "Contactless (071)" },
      {
        type: "paragraph",
        text:
          "O chip NFC gera um ARQC diferente do contato — usando o TTQ (Terminal Transaction Qualifiers, tag 9F66) e CTQ (Card Transaction Qualifiers, tag 9F6C) para negociar o que acontece offline vs online. Transações de baixo valor podem ser aprovadas offline pelo chip sem sequer chegar ao emissor.",
      },

      { type: "heading", level: 4, text: "CNP — Card Not Present (010, 081)" },
      {
        type: "paragraph",
        text:
          "Sem dados físicos do cartão — apenas PAN, validade e CVV2. Maior risco de fraude — requer controles adicionais: CVV2 (impresso no cartão), 3D Secure, análise de risco. O Bit 61 ou campos privados carregam dados adicionais de e-commerce (URL, device fingerprint, etc.).",
      },

      // ── 4. Quem define os campos obrigatórios ─────────────────────
      { type: "heading", level: 2, text: "Quem define os campos obrigatórios?" },
      {
        type: "paragraph",
        text:
          "A ISO 8583 define apenas a estrutura e o significado dos campos — não define quais são obrigatórios. Cada bandeira e rede define suas próprias regras de obrigatoriedade.",
      },
      {
        type: "table",
        headers: ["Nível", "Quem define", "Exemplo"],
        rows: [
          ["ISO 8583", "O padrão", "Apenas estrutura e codificação"],
          ["Bandeira", "Visa, Mastercard, Elo…", "Bit 19 obrigatório (Visa), Bit 43 (MC)"],
          ["Adquirente", "Cielo, Rede, Stone…", "Campos privados (Bit 47 / 48)"],
          ["Emissor", "Banco emissor", "Pode exigir dados adicionais na resposta"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "No ISOLeaf Builder, o papel selecionado (Adquirente, Bandeira, Emissor) determina quais campos são automaticamente incluídos na mensagem gerada, seguindo as convenções mais comuns do mercado brasileiro.",
      },

      // ── 5. Processing Code ───────────────────────────────────────
      { type: "heading", level: 2, text: "Processing Code — o DNA da transação" },
      {
        type: "paragraph",
        text:
          "O Bit 3 (Processing Code) define o que a transação faz com as contas do portador. São 6 dígitos em 3 subcampos. Veja exemplos comuns no mercado brasileiro:",
      },
      {
        type: "table",
        headers: ["Processing Code", "Transação", "Descrição"],
        rows: [
          ["003000", "Compra Crédito", "Débita conta crédito do portador"],
          ["003010", "Compra Crédito Parcelado", "Parcelamento lojista"],
          ["003030", "Compra Crédito Parcelado Emissor", "Parcelamento banco"],
          ["012020", "Saque à vista", "Débita conta corrente"],
          ["012030", "Saque crédito", "Saque na função crédito (raro)"],
          ["172020", "Consulta de saldo", "Não movimenta conta"],
          ["202020", "Devolução débito", "Crédito na conta corrente"],
          ["203000", "Devolução crédito", "Estorno de crédito"],
          ["302020", "Consulta de extrato", "Apenas informativa"],
          ["602020", "Pagamento de conta", "Crédito para beneficiário"],
        ],
      },

      // ── 6. Companhias aéreas ─────────────────────────────────────
      { type: "heading", level: 2, text: "Transações de companhias aéreas" },
      {
        type: "paragraph",
        text:
          "Transações de companhias aéreas têm características únicas que as diferenciam de uma compra comum em loja. O valor exato da passagem frequentemente não é conhecido no momento da reserva (tarifas, taxas, upgrades), então o fluxo usa pré-autorização + captura (completion).",
      },

      { type: "heading", level: 3, text: "Fluxo típico — airline transaction" },
      {
        type: "list",
        ordered: true,
        items: [
          "PRÉ-AUTORIZAÇÃO (0100 / 0200) — MCC 4511 (Air Carriers, Airlines), Processing Code 003000, valor estimado ou mínimo da tarifa. O emissor bloqueia o valor na conta do portador, mas não debita ainda.",
          "COMPLETION / CAPTURA (0220 — Advice) — após confirmação do bilhete. Valor final com todas as taxas incluídas. Pode ser maior ou menor que a pré-autorização. O Bit 90 pode conter os dados da pré-autorização original.",
          "CANCELAMENTO (0420 — Reversal Advice) — se o passageiro cancelar antes da emissão, libera o valor bloqueado na conta.",
        ],
      },

      { type: "heading", level: 3, text: "Dados específicos de airline" },
      {
        type: "paragraph",
        text:
          "As bandeiras definem campos específicos para dados de voo. Eles geralmente ficam nos campos privados (Bit 47, 48 ou 127) ou em campos específicos como o Bit 111 em algumas redes.",
      },
      {
        type: "table",
        headers: ["Campo", "Dados de voo comuns"],
        rows: [
          ["Bit 43", "Nome do estabelecimento com cidade / aeroporto"],
          ["Bit 47 / 48", "Dados privados: PNR, número do voo, origem / destino"],
          ["Bit 111", "Airline Additional Data (algumas redes)"],
        ],
      },

      { type: "heading", level: 3, text: "Terminologia de airline" },
      {
        type: "list",
        items: [
          "PNR (Passenger Name Record): identificador único da reserva no sistema da companhia aérea. Ex.: \"ABC123\".",
          "Leg Data: dados de cada trecho do voo (origem, destino, data, classe, número do voo).",
          "IATA Code: código de 2-3 letras da cia aérea (LA = LATAM, G3 = Gol).",
          "Ticket Number: número do bilhete eletrônico (e-ticket).",
          "EMD (Electronic Miscellaneous Document): documento para serviços ancilares (bagagem extra, upgrades, etc.).",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "As implementações de airline data variam muito entre bandeiras e adquirentes. Visa, Mastercard e Elo têm especificações próprias para esses campos. Consulte a especificação técnica da bandeira específica para implementação em produção.",
      },

      // ── 7. Outras transações especiais ───────────────────────────
      { type: "heading", level: 2, text: "Outros tipos de transação especiais" },

      { type: "heading", level: 3, text: "Pagamento de contas / débito direto" },
      {
        type: "paragraph",
        text:
          "Processing Code 60xxxx. Usado para pagamento de boletos, contas de água, luz, etc. Crédito direto na conta do beneficiário.",
      },

      { type: "heading", level: 3, text: "Recarga (pré-pago)" },
      {
        type: "paragraph",
        text:
          "Cartões pré-pagos têm fluxo diferente. O emissor é geralmente um processador de cartões pré-pagos. A recarga pode ser feita via Bit 4 com Processing Code específico.",
      },

      { type: "heading", level: 3, text: "Cashback" },
      {
        type: "paragraph",
        text:
          "Processing Code 09xxxx (saque embutido na compra). O Bit 4 = valor da compra + valor do saque. O Bit 54 = breakdown dos valores (compra separado do saque). Permitido em alguns terminais e redes específicas.",
      },

      // ── 8. Como testar no ISOLeaf ─────────────────────────────────
      { type: "heading", level: 2, text: "Como usar o ISOLeaf para testar esses cenários" },
      {
        type: "table",
        headers: ["Cenário", "MTI", "Classe", "Canal", "Descrição"],
        rows: [
          ["Compra crédito em loja (chip)",   "0100", "Autorização",  "Chip",      "Cliente compra em estabelecimento com chip"],
          ["Compra crédito em loja (tarja)",  "0100", "Autorização",  "Tarja",     "Cliente compra em estabelecimento com tarja"],
          ["Compra débito em loja (chip)",    "0100", "Autorização",  "Chip",      "Compra débito com PIN no estabelecimento"],
          ["Compra online / CNP",             "0100", "Autorização",  "CNP",       "E-commerce, MOTO, sem presença física"],
          ["Pré-autorização (posto / hotel)", "0100", "Autorização",  "Chip",      "Reserva valor, ajuste no checkout"],
          ["Saque em ATM",                    "0200", "Financeiro",   "Chip",      "Retirada de dinheiro no caixa eletrônico"],
          ["Troca de senha no ATM",           "0200", "Financeiro",   "Chip",      "Alteração de PIN no caixa eletrônico"],
          ["Depósito em ATM",                 "0200", "Financeiro",   "Chip",      "Crédito imediato na conta via ATM"],
          ["Transações proprietárias",        "Varia por rede", "Proprietário", "Chip", "MTIs customizados definidos pela rede (consulte a especificação técnica da rede)"],
          ["Reversão de compra",              "0400", "Reversão",     "(mesmo)",   "Cancela autorização 0100 anterior"],
          ["Reversão de saque",               "0400", "Reversão",     "(mesmo)",   "Cancela financeiro 0200 anterior"],
          ["Echo test",                       "0800", "Rede",         "(n/a)",     "Verifica conectividade com o emissor / bandeira"],
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "A linha \"Transações proprietárias\" usa MTI customizado — não é um padrão ISO 8583. Cada rede define seus próprios MTIs para funcionalidades que vão além do escopo do padrão. Para simular esses MTIs no ISOLeaf, configure a sessão do Simulador com \"MTI desconhecido: Custom\" e defina o MTI de resposta correspondente.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "No ISOLeaf Builder: Compra em loja → MTI 0100, Papel Adquirente. Saque em ATM → MTI 0200, Papel Adquirente, Tipo Saque. Reversão → use \"Criar reversão\" no MessagePreview (gera 0400 com Bit 90 preenchido automaticamente). Echo test → MTI 0800.",
      },
    ],
  },

  glossary: {
    id: "glossary",
    blocks: [
      {
        type: "table",
        headers: ["Termo", "Definição"],
        rows: [
          ["ATC", "Application Transaction Counter — contador sequencial no chip. Incrementa a cada transação. Usado na derivação da Session Key."],
          ["ARQC", "Application Request Cryptogram — criptograma gerado pelo chip para autenticar a transação. Bit 55, tag 9F26. 8 bytes."],
          ["ARPC", "Application Response Cryptogram — criptograma gerado pelo emissor em resposta ao ARQC. Tag 91. Comprova que o emissor é legítimo."],
          ["ARC", "Authorization Response Code — código de resposta do emissor em formato EMV. Tag 8A. Mesmo valor do RC (bit 39) em TLV."],
          ["BIN", "Bank Identification Number — primeiros 6-8 dígitos do PAN. Identifica emissor e bandeira; usado para roteamento."],
          ["CVV / CVC", "Card Verification Value/Code — código de 3 dígitos derivado do PAN, validade e chave do emissor. CVV1 na trilha, CVV2 impresso."],
          ["CNP", "Card Not Present — transação sem o cartão físico (ex: e-commerce). Maior risco de fraude."],
          ["CSU", "Card Status Update — bloco de dados usado no cálculo do ARPC Method 2. Permite atualizar o status do cartão."],
          ["DDA", "Dynamic Data Authentication — autenticação offline onde o chip assina dados dinâmicos. Mais seguro que SDA."],
          ["EMV", "Europay, Mastercard, Visa — padrão global para transações com chip."],
          ["IAD", "Issuer Application Data — dados proprietários do emissor no Bit 55 (tag 9F10). Inclui o perfil de criptograma (CVN)."],
          ["IMK", "Issuer Master Key — chave raiz do emissor. Usada para derivar a ICC MK. Nunca sai do HSM em produção."],
          ["LLVAR", "Campo variável com 2 dígitos de comprimento. Ex: '12HELLO WORLD!' (12 = comprimento)."],
          ["LLLVAR", "Campo variável com 3 dígitos de comprimento. Ex: '012HELLO WORLD!' (012 = comprimento)."],
          ["MTI", "Message Type Indicator — 4 dígitos que identificam o tipo da mensagem ISO 8583. Ex: 0200 = Financial Request."],
          ["NII", "Network Interface Identifier — identificador de 2 bytes atribuído pela bandeira. Usado no TPDU para roteamento."],
          ["PAN", "Primary Account Number — número do cartão. Bit 2. Geralmente 13-19 dígitos."],
          ["PIN Block", "Bloco criptografado contendo o PIN. Bit 52. 8 bytes em formato ISO 9564."],
          ["PSN", "PAN Sequence Number — número de sequência do cartão. Diferencia múltiplos cartões com mesmo PAN. Usado na derivação da ICC MK."],
          ["RC", "Response Code — 2 caracteres no bit 39 indicando o resultado. '00' = aprovado, '05' = recusado."],
          ["RRN", "Retrieval Reference Number — referência única da transação. Bit 37. 12 caracteres. Usado para rastreamento e estorno."],
          ["SDA", "Static Data Authentication — autenticação offline simples. O chip assina dados estáticos do cartão."],
          ["Session Key", "Chave derivada do ICC MK + ATC. Única por transação. Usada para calcular o ARQC."],
          ["STAN", "System Trace Audit Number — número sequencial. Bit 11. 6 dígitos. Único por terminal por dia."],
          ["TLV", "Tag-Length-Value — estrutura de codificação no Bit 55. Cada campo tem Tag, Length e Value."],
          ["TPDU", "Transport Protocol Data Unit — prefixo de 5 bytes antes do MTI em conexões TCP. ID + NII origem + NII destino."],
          ["TVR", "Terminal Verification Results — 5 bytes (40 bits) no Bit 55 (tag 95). Cada bit é o resultado de uma verificação no terminal."],
          ["UN", "Unpredictable Number — 4 bytes aleatórios gerados pelo terminal para o cálculo do ARQC. Tag 9F37."],
          ["ZPK", "Zone PIN Key — chave de criptografia de PIN. Usada para decriptar o PIN Block recebido."],
        ],
      },
    ],
  },

  fields: {
    id: "fields",
    blocks: [
      { type: "paragraph", text: "Tabela dos campos mais importantes do ISO 8583 (Data Elements 2-128)." },
      {
        type: "table",
        headers: ["Bit", "Nome", "Tipo", "Enc.", "Tamanho", "Descrição"],
        rows: [
          ["2", "PAN", "LLVAR", "n", "max 19", "Número do cartão"],
          ["3", "Processing Code", "FIXED", "n", "6", "Tipo de transação"],
          ["4", "Amount, Transaction", "FIXED", "n", "12", "Valor em centavos"],
          ["5", "Amount, Settlement", "FIXED", "n", "12", "Valor de liquidação"],
          ["6", "Amount, Cardholder Billing", "FIXED", "n", "12", "Valor ao portador"],
          ["7", "Transmission Date & Time", "FIXED", "n", "10", "MMDDHHmmss"],
          ["11", "STAN", "FIXED", "n", "6", "Número de rastreamento"],
          ["12", "Local Transaction Time", "FIXED", "n", "6", "HHmmss"],
          ["13", "Local Transaction Date", "FIXED", "n", "4", "MMDD"],
          ["14", "Expiration Date", "FIXED", "n", "4", "AAMM"],
          ["18", "Merchant Type (MCC)", "FIXED", "n", "4", "Categoria do estabelecimento"],
          ["19", "Acquiring Country Code", "FIXED", "n", "3", "País do adquirente"],
          ["22", "POS Entry Mode", "FIXED", "n", "3", "Como o cartão foi lido"],
          ["25", "POS Condition Code", "FIXED", "n", "2", "Condição do POS"],
          ["32", "Acquiring Institution ID", "LLVAR", "n", "max 11", "ID do adquirente"],
          ["35", "Track 2 Data", "LLVAR", "z", "max 37", "Trilha magnética"],
          ["37", "RRN", "FIXED", "an", "12", "Número de referência"],
          ["38", "Authorization ID Response", "FIXED", "an", "6", "Código de autorização"],
          ["39", "Response Code", "FIXED", "an", "2", "'00' = aprovado"],
          ["41", "Terminal ID", "FIXED", "ans", "8", "ID do terminal"],
          ["42", "Merchant ID", "FIXED", "ans", "15", "ID do estabelecimento"],
          ["43", "Card Acceptor Name/Location", "FIXED", "ans", "40", "Nome+cidade do estabelecimento"],
          ["48", "Additional Data — Private", "LLLVAR", "an", "max 999", "Dados privados"],
          ["49", "Currency Code, Transaction", "FIXED", "n", "3", "986 = BRL"],
          ["52", "PIN Data", "FIXED", "b", "8", "PIN Block (binário)"],
          ["54", "Additional Amounts", "LLLVAR", "an", "max 120", "Valores adicionais"],
          ["55", "ICC Data (EMV)", "LLLVAR", "b", "max 255", "Dados do chip BER-TLV"],
          ["57-63", "Reserved National/Private", "LLLVAR", "ans", "max 999", "Reservados nacionais/privados"],
          ["64", "MAC", "FIXED", "b", "8", "Autenticação da mensagem"],
          ["70", "Network Management Info Code", "FIXED", "n", "3", "0800/0810"],
          ["90", "Original Data Elements", "FIXED", "n", "42", "Dados da msg original (reversão)"],
          ["100", "Receiving Institution ID", "LLVAR", "n", "max 11", "ID do emissor"],
          ["127", "Private Use", "LLLVAR", "ans", "max 999", "Uso privado"],
          ["128", "MAC (Extended)", "FIXED", "b", "8", "MAC estendido"],
        ],
      },
      { type: "heading", level: 3, text: "Tipos de encoding" },
      {
        type: "list",
        items: [
          "n = numérico (dígitos 0-9)",
          "a = alfabético (A-Z, espaço)",
          "s = especial (caracteres especiais)",
          "an = alfanumérico",
          "ans = alfanumérico e especial",
          "b = binário",
          "z = trilha magnética (dígitos + separadores)",
          "x+n = sinal (C/D) + numérico",
        ],
      },
      { type: "heading", level: 3, text: "Tipos de comprimento" },
      {
        type: "list",
        items: [
          "FIXED = tamanho fixo",
          "LLVAR = 2 dígitos de comprimento + valor (max 99)",
          "LLLVAR = 3 dígitos de comprimento + valor (max 999)",
        ],
      },
    ],
  },

  guides: {
    id: "guides",
    blocks: [
      { type: "heading", level: 2, text: "Arquitetura do ISOLeaf" },
      {
        type: "paragraph",
        text:
          "O ISOLeaf é uma aplicação standalone que roda inteiramente na sua máquina. Nenhum dado sai do seu ambiente.",
      },
      { type: "svg", text: ISOHUB_ARCHITECTURE_SVG },
      { type: "heading", level: 3, text: "Segurança" },
      { type: "callout", tone: "success", text: "Dados ficam na sua máquina — zero telemetria, sem conexões externas além das que você configurar." },
      { type: "callout", tone: "warning", text: "Sem autenticação JWT — acesso livre em localhost. Se expor a porta 8080 na rede (0.0.0.0), qualquer máquina da rede pode acessar sem senha. Use apenas em redes confiáveis ou com firewall." },
      { type: "heading", level: 3, text: "Dados armazenados localmente" },
      {
        type: "list",
        items: [
          "Workspace (IMK, ZPK, configurações): arquivo JSON local",
          "Templates: localStorage do browser",
          "Histórico EMV: memória da sessão (limpo ao reiniciar)",
        ],
      },

      // ── Primeiros passos — visão geral dos módulos ─────────────────
      { type: "heading", level: 2, text: "Primeiros passos — conhecendo os módulos" },
      {
        type: "paragraph",
        text:
          "O ISOLeaf é organizado em seis módulos. Antes de mergulhar em um guia específico, vale conhecer rapidamente o que cada um faz.",
      },

      { type: "heading", level: 3, text: "Parser" },
      {
        type: "paragraph",
        text:
          "O módulo mais usado. Cole qualquer mensagem ISO 8583 (ASCII wire ou binary-hex, com ou sem TPDU) e veja todos os campos decodificados automaticamente. Clique em qualquer campo para copiar, revelar valores mascarados ou navegar para outros módulos.",
      },
      {
        type: "image",
        src: "/screenshots/parse1.png",
        alt: "Tela do Parser",
        caption: "Parser — decodifica qualquer mensagem ISO 8583",
      },

      { type: "heading", level: 3, text: "Builder" },
      {
        type: "paragraph",
        text:
          "Gera mensagens ISO 8583 completas sem precisar conhecer cada campo. Selecione o contexto (papel, bandeira, canal, tipo de transação) e o ISOLeaf preenche automaticamente os campos corretos — incluindo o Bit 55 com ARQC real quando a IMK está configurada no Workspace.",
      },
      {
        type: "image",
        src: "/screenshots/builder.png",
        alt: "Tela do Builder",
        caption: "Builder — gera mensagens completas por contexto",
      },

      { type: "heading", level: 3, text: "Simulador" },
      {
        type: "paragraph",
        text:
          "Suba um Rebatedor para receber mensagens TCP e responder automaticamente — simulando um autorizador/emissor. Ou use o Injetor para enviar mensagens ao seu sistema e acompanhar as respostas em tempo real.",
      },
      {
        type: "image",
        src: "/screenshots/simulator.png",
        alt: "Tela do Simulador",
        caption: "Simulador — Rebatedor ativo e Injetor",
      },

      { type: "heading", level: 3, text: "Dados EMV" },
      {
        type: "paragraph",
        text:
          "Seis tabs para trabalhar com criptografia EMV: Parse Bit 55, Validate ARQC, Generate ARQC, Generate ARPC, Build Response e Full Flow.",
      },
      {
        type: "image",
        src: "/screenshots/emv1.png",
        alt: "Tela de Dados EMV",
        caption: "Dados EMV — Parse Bit 55 com tags decodificadas",
      },

      { type: "heading", level: 3, text: "Cartão de teste" },
      {
        type: "paragraph",
        text:
          "Gera PANs válidos com trilhas e CVV por bandeira para usar em testes sem precisar de cartões reais.",
      },
      {
        type: "image",
        src: "/screenshots/testcard.png",
        alt: "Tela de Cartão de teste",
        caption: "Cartão de teste — gera dados válidos por bandeira",
      },

      { type: "heading", level: 3, text: "Workspace" },
      {
        type: "paragraph",
        text:
          "Configure valores padrão (Terminal ID, Merchant ID, NIIs) e chaves criptográficas (IMK, ZPK) que são usadas automaticamente pelo Builder e pelo Simulador.",
      },
      {
        type: "image",
        src: "/screenshots/workspace.png",
        alt: "Tela do Workspace",
        caption: "Workspace — configurações e chaves criptográficas",
      },

      { type: "divider" },

      // ── Guias práticos ────────────────────────────────────────────
      { type: "heading", level: 2, text: "Guias práticos" },
      {
        type: "paragraph",
        text:
          "Passo a passo dos fluxos mais comuns no ISOLeaf. Cada guia parte de um cenário concreto e mostra os cliques exatos.",
      },

      {
        type: "heading",
        level: 3,
        text: "Parsear uma mensagem ISO 8583",
        subtitle: "Cenário: você recebeu uma mensagem ISO 8583 e precisa entender o que ela contém.",
      },
      {
        type: "image",
        src: "/screenshots/parse1.png",
        alt: "Tela do Parser com mensagem ISO 8583 decodificada",
        caption: "Parser — cole uma mensagem e veja todos os campos decodificados",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra o módulo **Parser**.",
          "Cole a mensagem no campo de texto (aceita ASCII wire, binary-hex ou com TPDU).",
          "Clique **Parsear →** ou pressione `Ctrl+Enter`. O ISOLeaf detecta o formato automaticamente.",
        ],
      },
      { type: "callout", tone: "info", text: "Colar uma mensagem já dispara o parse automaticamente (300 ms de debounce)." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Gerar uma mensagem ISO 8583",
        subtitle: "Cenário: você precisa de uma mensagem pronta para testar uma integração.",
      },
      {
        type: "image",
        src: "/screenshots/builder.png",
        alt: "Tela do Builder com campos gerados automaticamente",
        caption: "Builder — selecione o contexto e gere a mensagem completa",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra o módulo **Builder**.",
          "Selecione **MTI**, **Papel**, **Bandeira**, **Canal** e **Tipo de transação**.",
          "Clique **Gerar →**. Os campos são preenchidos automaticamente.",
          "Edite os valores que precisar na tabela.",
          "Copie a mensagem gerada (ASCII wire ou binary-hex).",
        ],
      },
      { type: "callout", tone: "info", text: "Configure a IMK no **Workspace** para gerar **ARQC** real em vez de aleatório." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Validar ARQC de uma transação",
        subtitle: "Cenário: você recebeu uma mensagem com Bit 55 e quer confirmar que o criptograma é legítimo.",
      },
      {
        type: "image",
        src: "/screenshots/emv2.png",
        alt: "Tela de validação de ARQC no módulo Dados EMV",
        caption: "Dados EMV — Validação de ARQC com resultado detalhado",
      },
      { type: "paragraph", text: "Pré-requisito: ter o Bit 55 em hex e a IMK do emissor." },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra **Dados EMV** → aba **Validate ARQC**.",
          "Cole o Bit 55 em hex.",
          "Informe a Issuer Master Key (**IMK-AC**).",
          "Informe o **PAN** e o **PAN Sequence Number** (geralmente `00`).",
          "Selecione o perfil da bandeira.",
          "Clique **Validar ARQC**.",
        ],
      },
      { type: "callout", tone: "info", text: "Use **Validar no EMV** diretamente no **Parser** — o PAN e a bandeira são preenchidos automaticamente após parsear uma mensagem com Bit 55." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Simular um autorizador (Rebatedor)",
        subtitle: "Cenário: você tem um terminal/sistema que envia transações e quer simular o autorizador.",
      },
      {
        type: "image",
        src: "/screenshots/simulator.png",
        alt: "Tela do Simulador com sessão rebatedor ativa",
        caption: "Simulador — Rebatedor ativo recebendo e respondendo mensagens",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra **Simulador** e clique **+ Nova sessão**.",
          "Configure: **Porta TCP** (ex.: `9100`), **Papel** = `Emissor`, **RC padrão** = `00`, **Resposta automática** ligada.",
          "Clique **Confirmar**.",
          "Aponte seu terminal para `localhost:9100`.",
          "O ISOLeaf responde automaticamente a cada mensagem recebida.",
        ],
      },
      { type: "callout", tone: "info", text: "Clique no ícone de log no card da sessão para filtrar o log apenas dessa sessão." },

      { type: "heading", level: 4, text: "Rebatedor (Listener)" },
      {
        type: "paragraph",
        text:
          "Abre uma porta TCP local e aguarda conexões. Quando recebe uma mensagem, responde automaticamente conforme as configurações da sessão.",
      },
      { type: "paragraph", text: "Campos de configuração:" },
      {
        type: "list",
        items: [
          "**Porta TCP**: porta local onde vai escutar (ex.: `9100`).",
          "**Papel**: define o contexto da resposta automática — `Adquirente` (simula uma credenciadora), `Bandeira` (simula a rede) ou `Emissor` (simula o banco emissor, mais comum).",
          "**RC padrão**: código de resposta padrão (`00` = aprovar tudo).",
          "**Modo TPDU**: como tratar o prefixo TPDU — `Opcional` (aceita com ou sem), `Obrigatório` (rejeita sem TPDU) ou `Remover` (strip antes de processar).",
          "**MTI desconhecido**: como responder a MTIs não mapeados — `Derivar` (tenta `0100`→`0110` automaticamente), `Rejeitar` (não responde), `Ecoar` (responde com o mesmo MTI) ou `Customizado` (MTI específico).",
          "**Resposta automática**: toggle para ligar/desligar.",
          "**Validar ARQC**: verifica o criptograma EMV (requer IMK configurada no **Workspace**).",
        ],
      },
      {
        type: "image",
        src: "/screenshots/new_session.png",
        alt: "Formulário de nova sessão do Simulador",
        caption: "Criação de sessão — configurações do Rebatedor",
      },

      { type: "heading", level: 4, text: "Injetor (Connector)" },
      {
        type: "paragraph",
        text:
          "Conecta a um sistema TCP externo e envia mensagens. Use para testar seu autorizador enviando transações e verificando as respostas.",
      },
      { type: "paragraph", text: "Campos de configuração:" },
      {
        type: "list",
        items: [
          "**Host destino**: IP ou hostname do sistema alvo.",
          "**Porta destino**: porta TCP do sistema alvo (ex.: `8583`).",
          "**Mensagem**: a ISO 8583 a enviar (hex ou ASCII wire).",
          "**Modo contínuo**: envia em loop (1 msg/s). Marque **Variar identificadores** para STAN/RRN/DateTime mudarem a cada envio; **Variar valor** para Amount aleatório dentro de um range.",
        ],
      },

      { type: "heading", level: 4, text: "Log ao vivo" },
      {
        type: "paragraph",
        text:
          "Mostra em tempo real todas as mensagens recebidas e enviadas pelos Rebatedores. Clique no ícone de log em cada sessão para filtrar apenas aquela sessão.",
      },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Injetar mensagens (Injetor)",
        subtitle: "Cenário: você tem um autorizador rodando e quer enviar transações para testá-lo.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra **Simulador** → seção **Injetor**.",
          "Configure **Host destino** e **Porta destino** (ex.: `localhost:8583`).",
          "Cole a mensagem ISO 8583 no campo de texto (pode usar uma gerada pelo **Builder**).",
          "Clique **Injetar →** para enviar uma única mensagem ou **Iniciar contínuo** para loop (1 msg/s).",
        ],
      },
      { type: "callout", tone: "info", text: "Marque **Variar identificadores** para que cada envio tenha STAN/RRN diferente — evita rejeição por duplicata." },

      { type: "divider" },

      { type: "heading", level: 2, text: "As 6 tabs do módulo Dados EMV" },
      {
        type: "paragraph",
        text:
          "O módulo **Dados EMV** organiza os fluxos de criptografia em seis tabs encadeáveis. Você pode usar cada uma isolada ou combiná-las no **Full Flow**.",
      },
      {
        type: "list",
        items: [
          "**Parse Bit 55**: cole um Bit 55 em hex e veja todas as tags BER-TLV decodificadas. Suporta parse parcial — se encontrar uma tag inválida, mostra o que conseguiu parsear até aquele ponto.",
          "**Validate ARQC**: valide se um ARQC recebido é legítimo. Informe o Bit 55, a IMK e o PAN. O ISOLeaf recalcula a cadeia de derivação e compara com o ARQC recebido.",
          "**Generate ARQC**: gere um ARQC real a partir de dados de transação. Útil para criar dados de teste realistas ou verificar sua implementação de derivação.",
          "**Generate ARPC**: gere o ARPC (resposta do emissor) a partir do ARQC recebido. Method 1 ou Method 2.",
          "**Build Response**: monte o Bit 55 de resposta (tags `91` + `8A`) que o emissor deve retornar na mensagem de resposta.",
          "**Full Flow**: executa os 4 passos em sequência automática — **Parse Bit 55** → **Validate ARQC** → **Generate ARPC** → **Build Response**. O fluxo completo do emissor em um único clique.",
        ],
      },
      {
        type: "image",
        src: "/screenshots/emv6.png",
        alt: "Full Flow EMV com resultado completo",
        caption: "Full Flow — ARQC validado, ARPC gerado, Bit 55 montado",
      },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Full Flow EMV",
        subtitle: "Cenário: receber uma transação com chip e responder corretamente com ARPC.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra **Dados EMV** → aba **Full Flow**.",
          "Preencha: **Bit 55** hex da mensagem recebida, **IMK-AC**, **PAN**, **PAN Sequence Number**, **Auth Response Code**.",
          "Clique **Run Full EMV Flow**.",
          "O ISOLeaf parseia o Bit 55, valida o ARQC, gera o ARPC e monta o Bit 55 de resposta (tags `91` + `8A`).",
          "Copie o Bit 55 de resposta para incluir na sua `0110` / `0210`.",
        ],
      },
    ],
  },
};
