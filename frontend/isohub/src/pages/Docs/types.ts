/**
 * Structured doc blocks. We render docs from typed data instead of inline JSX
 * so the same renderer works for both locales and the per-block content lives
 * outside i18n JSON (long-form prose is awkward in JSON).
 */
export type DocBlock =
  /**
   * Section heading. `subtitle` renders below the title in muted/italic
   * — useful for one-line context ("Cenário: …", "Para usuários que querem …").
   */
  | { type: "heading"; level: 2 | 3 | 4; text: string; subtitle?: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "code"; lang?: string; text: string }
  | { type: "diagram"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; tone: "info" | "warning" | "success" | "danger"; text: string }
  /**
   * Inline SVG embedded via dangerouslySetInnerHTML. Authors are responsible
   * for the markup — only static strings defined in content.{pt,en}.ts should
   * land here. Never accept user input through this block.
   */
  | { type: "svg"; text: string }
  /**
   * Static screenshot or illustration. `src` is a path served by the Agent
   * (e.g. "/screenshots/parse1.png"). Files in frontend/public/ are copied
   * to wwwroot/ by Vite's build.
   */
  | { type: "image"; src: string; alt: string; caption?: string }
  /** Horizontal rule separating logically distinct sections. */
  | { type: "divider" };

export interface DocSection {
  /** Stable id used in URL hashes (e.g. /docs#iso8583). */
  id: string;
  blocks: DocBlock[];
}
