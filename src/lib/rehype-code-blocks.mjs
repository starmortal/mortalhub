// Wrap every code block in a positioning shell, and collapse the long ones.
//
// Runs as a rehype plugin rather than a Shiki transformer: Shiki reassigns the
// <pre> properties after its own hooks fire, so attributes added there are
// discarded.
//
// The shell exists because the <pre> scrolls horizontally. Anything positioned
// inside it — the language label, and the copy button the client script adds —
// rides along when a wide line is scrolled, which reads as the control having
// drifted off to the middle of the block. Living in the shell keeps them pinned.
const COLLAPSE_AFTER_LINES = 15;

const isElement = (node, tagName) =>
  node?.type === 'element' && node?.tagName === tagName;

// Shiki writes the class list as a plain `class` string, while rehype's own
// convention is a `className` array. Either can be present but empty, so merge
// every shape instead of falling back with ??.
const classList = (node) => {
  const { className, class: classAttr } = node.properties ?? {};

  return [
    ...(Array.isArray(className) ? className : []),
    ...(typeof className === 'string' ? className.split(/\s+/) : []),
    ...String(classAttr ?? '').split(/\s+/),
  ].filter(Boolean);
};

// Shiki wraps every rendered line in span.line inside <code>, which holds
// across Shiki versions.
const countLines = (pre) => {
  const code = pre.children?.find((child) => isElement(child, 'code'));

  if (!code?.children) {
    return 0;
  }

  return code.children.filter((child) => isElement(child, 'span')).length;
};

export default function rehypeCodeBlocks() {
  return (tree) => {
    const wrap = (parent) => {
      if (!Array.isArray(parent.children)) {
        return;
      }

      parent.children = parent.children.map((child) => {
        if (!isElement(child, 'pre')) {
          return child;
        }

        const collapsed = countLines(child) > COLLAPSE_AFTER_LINES;

        // Lift the language label up into the shell so it stays put too.
        const label = child.children?.find(
          (node) => isElement(node, 'span') && classList(node).includes('code-lang'),
        );

        if (label) {
          child.children = child.children.filter((node) => node !== label);
        }

        return {
          type: 'element',
          tagName: 'div',
          // Plain-object marker: never serialised, and it survives the recursion
          // below, which revisits every element including this new shell.
          codeBlockWrapper: true,
          properties: {
            className: collapsed
              ? ['code-block', 'is-collapsed']
              : ['code-block'],
          },
          children: label ? [child, label] : [child],
        };
      });

      for (const child of parent.children) {
        if (isElement(child) && !child.codeBlockWrapper) {
          wrap(child);
        }
      }
    };

    wrap(tree);
  };
}
