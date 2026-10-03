// Side-by-side image galleries: wrap a run of images in [grid] … [/grid] and
// they render as an even grid instead of stacking one per row.
//
// Runs at the remark (mdast) stage — before the tree becomes HTML — so the
// columns are baked into the output rather than computed in the browser.
//
// The state machine below is needed because a blank line between images makes
// each one its own paragraph: the markers can sit in a different paragraph from
// the images they wrap, so a simple map over paragraphs would miss them.
const GRID_OPEN = /^\s*\[grid\]\s*/;
const GRID_CLOSE = /\s*\[\/grid\]\s*$/;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 4;

const edgeText = (node, position) => {
  if (node?.type !== 'paragraph') {
    return null;
  }

  const child = position === 'first' ? node.children?.[0] : node.children?.at(-1);
  return child?.type === 'text' ? child : null;
};

const countImages = (nodes) => {
  let total = 0;

  const walk = (node) => {
    if (!node) {
      return;
    }

    if (node.type === 'image') {
      total += 1;
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(walk);
    }
  };

  nodes.forEach(walk);
  return total;
};

const buildGrid = (nodes) => {
  const columns = Math.min(
    MAX_COLUMNS,
    Math.max(MIN_COLUMNS, countImages(nodes)),
  );

  return {
    type: 'paragraph',
    data: {
      hName: 'div',
      hProperties: { className: ['image-grid', `image-grid--${columns}`] },
    },
    children: nodes,
  };
};

// A paragraph reduced to nothing by stripping its marker carries no content.
const hasContent = (node, text) =>
  node.children.length > 1 || Boolean(text.value.trim());

export default function remarkImageGrid() {
  return (tree) => {
    if (tree.type !== 'root' || !Array.isArray(tree.children)) {
      return;
    }

    const next = [];
    let collected = null;

    for (const node of tree.children) {
      if (collected === null) {
        const opener = edgeText(node, 'first');

        if (opener && GRID_OPEN.test(opener.value)) {
          opener.value = opener.value.replace(GRID_OPEN, '');
          collected = [];

          const closer = edgeText(node, 'last');

          if (closer && GRID_CLOSE.test(closer.value)) {
            closer.value = closer.value.replace(GRID_CLOSE, '');

            if (hasContent(node, closer)) {
              collected.push(node);
            }

            next.push(buildGrid(collected));
            collected = null;
          } else if (hasContent(node, opener)) {
            collected.push(node);
          }

          continue;
        }

        next.push(node);
        continue;
      }

      const closer = edgeText(node, 'last');

      if (closer && GRID_CLOSE.test(closer.value)) {
        closer.value = closer.value.replace(GRID_CLOSE, '');

        if (hasContent(node, closer)) {
          collected.push(node);
        }

        next.push(buildGrid(collected));
        collected = null;
        continue;
      }

      collected.push(node);
    }

    // An unclosed [grid] is a typo, not a reason to swallow the rest of the
    // article — put the collected nodes back untouched.
    if (collected) {
      next.push(...collected);
    }

    tree.children = next;
  };
}
