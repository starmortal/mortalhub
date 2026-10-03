// Shape Shiki's output so the stylesheet stays in charge of code blocks:
// - Drop any inline background/color Shiki hardcodes, otherwise they outrank
//   the --code-bg / --code-text design tokens and freeze the block to one hex
// - Tag each block with its language so CSS can render a corner label
// Plain HAST nodes only — no extra dependency, nothing is parsed as HTML.
// Long-block collapsing lives in rehype-code-blocks.mjs: Shiki reassigns the
// <pre> properties after this hook, which would discard attributes set here.
const MUTED_LANGS = new Set(['plaintext', 'plain', 'text', 'txt', 'ansi']);

const dropPaintDeclarations = (style) =>
  style
    .split(';')
    .filter((decl) => !/^\s*(?:background(?:-color)?|color)\s*:/i.test(decl))
    .join(';')
    .trim();

export default function shikiCodeBlocks() {
  return {
    name: 'shiki-code-blocks',
    pre(node) {
      const style = node.properties?.style;

      if (typeof style === 'string') {
        const kept = dropPaintDeclarations(style);

        if (kept) {
          node.properties.style = kept;
        } else {
          delete node.properties.style;
        }
      }

      const lang = this.options.lang;

      if (lang && !MUTED_LANGS.has(lang)) {
        node.children.push({
          type: 'element',
          tagName: 'span',
          properties: { class: 'code-lang', 'aria-hidden': 'true' },
          children: [{ type: 'text', value: lang }],
        });
      }
    },
  };
}
