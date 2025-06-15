declare module "@babel/generator" {
  import * as t from "@babel/types"

  export interface GeneratorOptions {
    auxiliaryCommentAfter?: string
    auxiliaryCommentBefore?: string
    comments?: boolean
    compact?: boolean | "auto"
    concise?: boolean
    decoratorsBeforeExport?: boolean
    filename?: string
    importAttributesKeyword?: "with" | "assert" | "with-legacy"
    jsescOption?: {
      quotes?: "single" | "double" | "backtick"
      numbers?: "binary" | "octal" | "decimal" | "hexadecimal"
      wrap?: boolean
      es6?: boolean
      escapeEverything?: boolean
      minimal?: boolean
      isScriptContext?: boolean
      compact?: boolean
      indent?: string
      indentLevel?: number
      json?: boolean
      lowercaseHex?: boolean
    }
    jsonCompatibleStrings?: boolean
    minified?: boolean
    retainFunctionParens?: boolean
    retainLines?: boolean
    sourceFileName?: string
    sourceMaps?: boolean
    sourceRoot?: string
    shouldPrintComment?: (comment: string) => boolean
  }

  export interface GeneratorResult {
    code: string
    map: {
      version: number
      sources: string[]
      names: string[]
      sourceRoot?: string
      sourcesContent?: string[]
      mappings: string
      file: string
    } | null
  }

  export function generate(
    ast: t.Node,
    opts?: GeneratorOptions,
    code?: string | { [filename: string]: string }
  ): GeneratorResult

  export default generate
}
