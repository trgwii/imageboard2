const {
  createShikiHighlighter,
  renderCodeToHTML,
  runTwoSlash,
} = require("shiki-twoslash");

const zigGrammar = {
  $schema:
    "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
  name: "zig",
  scopeName: "source.zig",
  fileTypes: ["zig"],
  patterns: [
    {
      include: "#comments",
    },
    {
      include: "#strings",
    },
    {
      include: "#keywords",
    },
    {
      include: "#operators",
    },
    {
      include: "#numbers",
    },
    {
      include: "#support",
    },
    {
      include: "#variables",
    },
  ],
  repository: {
    variables: {
      patterns: [
        {
          name: "meta.function.declaration.zig",
          patterns: [
            {
              match: "\\b(fn)\\s+([A-Z][a-zA-Z0-9]*)\\b",
              captures: {
                1: {
                  name: "storage.type.function.zig",
                },
                2: {
                  name: "entity.name.type.zig",
                },
              },
            },
            {
              match: "\\b(fn)\\s+([_a-zA-Z][_a-zA-Z0-9]*)\\b",
              captures: {
                1: {
                  name: "storage.type.function.zig",
                },
                2: {
                  name: "entity.name.function.zig",
                },
              },
            },
            {
              begin: '\\b(fn)\\s+@"',
              end: '"',
              name: "entity.name.function.zig",
              beginCaptures: {
                1: {
                  name: "storage.type.function.zig",
                },
              },
              patterns: [
                {
                  include: "#stringcontent",
                },
              ],
            },
            {
              name: "keyword.default.zig",
              match: "\\b(const|var|fn)\\b",
            },
          ],
        },
        {
          name: "meta.function.call.zig",
          patterns: [
            {
              match: "([A-Z][a-zA-Z0-9]*)(?=\\s*\\()",
              name: "entity.name.type.zig",
            },
            {
              match: "([_a-zA-Z][_a-zA-Z0-9]*)(?=\\s*\\()",
              name: "entity.name.function.zig",
            },
          ],
        },
        {
          name: "meta.variable.zig",
          patterns: [
            {
              match: "\\b[_A-Z][_A-Z0-9]+\\b",
              name: "variable.constant.zig",
            },
            {
              match: "\\b[_a-zA-Z][_a-zA-Z0-9]*_t\\b",
              name: "entity.name.type.zig",
            },
            {
              match: "\\b[A-Z][a-zA-Z0-9]*\\b",
              name: "entity.name.type.zig",
            },
            {
              match: "\\b[_a-zA-Z][_a-zA-Z0-9]*\\b",
              name: "variable.zig",
            },
            {
              begin: '@"',
              end: '"',
              name: "variable.zig",
              patterns: [
                {
                  include: "#stringcontent",
                },
              ],
            },
          ],
        },
      ],
    },
    keywords: {
      patterns: [
        {
          match: "(\\binline\\b)?\\s*\\b(while|for)\\b",
          name: "keyword.control.repeat.zig",
        },
        {
          name: "keyword.storage.zig",
          match:
            "\\b(extern|packed|export|pub|noalias|inline|comptime|volatile|align|linksection|threadlocal|allowzero|noinline|callconv)\\b",
        },
        {
          name: "keyword.structure.zig",
          match: "\\b(struct|enum|union|opaque)\\b",
        },
        {
          name: "keyword.statement.zig",
          match: "\\b(asm|unreachable)\\b",
        },
        {
          name: "keyword.control.flow.zig",
          match: "\\b(break|return|continue|defer|errdefer)\\b",
        },
        {
          name: "keyword.control.async.zig",
          match: "\\b(await|resume|suspend|async|nosuspend)\\b",
        },
        {
          name: "keyword.control.trycatch.zig",
          match: "\\b(try|catch)\\b",
        },
        {
          name: "keyword.control.conditional.zig",
          match: "\\b(if|else|switch|orelse)\\b",
        },
        {
          name: "keyword.constant.default.zig",
          match: "\\b(null|undefined)\\b",
        },
        {
          name: "keyword.constant.bool.zig",
          match: "\\b(true|false)\\b",
        },
        {
          match:
            "[\\s\\(\\[\\{](\\.[_a-zA-Z][_a-zA-Z0-9]*)(?!\\s*=[^>]|\\s*\\()(?![_a-zA-Z0-9])",
          captures: {
            1: {
              name: "variable.other.enummember.zig",
            },
          },
        },
        {
          match: '[\\s\\(\\[\\{](\\.@"[^"]*")(?!\\s*=[^>]|\\s*\\()',
          captures: {
            1: {
              name: "variable.other.enummember.zig",
            },
          },
        },
        {
          name: "keyword.default.zig",
          match: "\\b(usingnamespace|test|and|or)\\b",
        },
        {
          name: "meta.error-set.zig",
          patterns: [
            {
              begin: "\\b(error)\\b\\s*{",
              end: "}",
              beginCaptures: {
                1: {
                  name: "keyword.type.zig",
                },
              },
              patterns: [
                {
                  match: "\\b[_a-zA-Z][_a-zA-Z0-9]*\\b",
                  name: "variable.constant.error.zig",
                },
                {
                  include: "$self",
                },
              ],
            },
            {
              begin: "\\b(error)\\b",
              end: "\\b([_a-zA-Z][_a-zA-Z0-9]*)\\b",
              beginCaptures: {
                1: {
                  name: "keyword.type.zig",
                },
              },
              endCaptures: {
                1: {
                  name: "variable.constant.error.zig",
                },
              },
              patterns: [
                {
                  include: "$self",
                },
              ],
            },
          ],
        },
        {
          name: "keyword.type.zig",
          match:
            "\\b(bool|void|noreturn|type|error|anyerror|anyframe|anytype|anyopaque)\\b",
        },
        {
          name: "keyword.type.integer.zig",
          match:
            "\\b(f16|f32|f64|f128|u\\d+|i\\d+|isize|usize|comptime_int|comptime_float)\\b",
        },
        {
          name: "keyword.type.c.zig",
          match:
            "\\b(c_short|c_ushort|c_int|c_uint|c_long|c_ulong|c_longlong|c_ulonglong|c_longdouble)\\b",
        },
      ],
    },
    operators: {
      patterns: [
        {
          name: "keyword.operator.c-pointer.zig",
          match: "\\[*c\\]",
        },
        {
          name: "keyword.operator.comparison.zig",
          match: "(\\b(and|or)\\b)|(==|!=)",
        },
        {
          name: "keyword.operator.arithmetic.zig",
          match: "(-%?|\\+%?|\\*%?|/|%)=?",
        },
        {
          name: "keyword.operator.bitwise.zig",
          match: "(<<%?|>>|!|&|\\^|\\|)=?",
        },
        {
          name: "keyword.operator.special.zig",
          match: "(==|\\+\\+|\\*\\*|->)",
        },
      ],
    },
    comments: {
      patterns: [
        {
          name: "comment.line.documentation.zig",
          begin: "//[!/](?=[^/])",
          end: "$",
          patterns: [
            {
              include: "#commentContents",
            },
          ],
        },
        {
          name: "comment.line.double-slash.zig",
          begin: "//",
          end: "$",
          patterns: [
            {
              include: "#commentContents",
            },
          ],
        },
      ],
    },
    commentContents: {
      patterns: [
        {
          match: "\\b(TODO|FIXME|XXX|NOTE)\\b:?",
          name: "keyword.todo.zig",
        },
      ],
    },
    strings: {
      patterns: [
        {
          name: "string.quoted.double.zig",
          begin: '"',
          end: '"',
          patterns: [
            {
              include: "#stringcontent",
            },
          ],
        },
        {
          name: "string.multiline.zig",
          begin: "\\\\\\\\",
          end: "$",
        },
        {
          name: "string.quoted.single.zig",
          match:
            "'([^'\\\\]|\\\\(x\\h{2}|[0-2][0-7]{,2}|3[0-6][0-7]?|37[0-7]?|[4-7][0-7]?|.))'",
        },
      ],
    },
    stringcontent: {
      patterns: [
        {
          name: "constant.character.escape.zig",
          match: "\\\\([nrt'\"\\\\]|(x[0-9a-fA-F]{2})|(u\\{[0-9a-fA-F]+\\}))",
        },
        {
          name: "invalid.illegal.unrecognized-string-escape.zig",
          match: "\\\\.",
        },
      ],
    },
    numbers: {
      patterns: [
        {
          name: "constant.numeric.float.zig",
          match: "\\b[0-9][0-9_]*(\\.[0-9][0-9_]*)?([eE][+-]?[0-9_]+)?\\b",
        },
        {
          name: "constant.numeric.decimal.zig",
          match: "\\b[0-9][0-9_]*\\b",
        },
        {
          name: "constant.numeric.hexadecimal.zig",
          match: "\\b0x[a-fA-F0-9_]+\\b",
        },
        {
          name: "constant.numeric.octal.zig",
          match: "\\b0o[0-7_]+\\b",
        },
        {
          name: "constant.numeric.binary.zig",
          match: "\\b0b[01_]+\\b",
        },
      ],
    },
    support: {
      patterns: [
        {
          comment: "Built-in functions",
          name: "support.function.builtin.zig",
          match: "@[_a-zA-Z][_a-zA-Z0-9]*",
        },
      ],
    },
  },
};

(async () => {
  const lang = process.argv[2];
  let code = "";
  process.stdin.setEncoding("utf-8");
  for await (const chunk of process.stdin) {
    code += chunk;
  }
  const highlighter = await createShikiHighlighter({ theme: "dark-plus" });
  if (lang === "zig") {
    await highlighter.loadLanguage({
      id: "zig",
      scopeName: "source.zig",
      grammar: zigGrammar,
      aliases: ["zig", "ziglang"],
    });
  }
  if (
    ["js", "javascript", "ts", "typescript", "tsx", "jsx", "json", "jsn"]
      .includes(lang)
  ) {
    try {
      const twoslash = runTwoSlash(code, lang);
      const html = renderCodeToHTML(
        twoslash.code,
        twoslash.extension,
        { twoslash: true },
        {},
        highlighter,
        twoslash,
      );

      process.stdout.write(html);
    } catch {
      console.log(highlighter.codeToHtml(code, lang));
    }
  } else {
    try { console.log(highlighter.codeToHtml(code, lang?.toLowerCase())); }
    catch { console.log(highlighter.codeToHtml(code, "text")); }
  }
})();
