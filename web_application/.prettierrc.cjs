module.exports = {
  trailingComma: "es5",
  bracketSpacing: true,
  jsxBracketSameLine: false,
  jsxSingleQuote: false,
  semi: false,
  requirePragma: false,
  proseWrap: "preserve",
  arrowParens: "avoid",
  htmlWhitespaceSensitivity: "css",
  quoteProps: "as-needed",
  embeddedLanguageFormatting: "auto",
  // options for import sorting with @ianvs/prettier-plugin-sort-imports
  importOrder: ["^~/(.*)$", "^[./]"],
  importOrderBuiltinModulesToTop: true,
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
}
