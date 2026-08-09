import { visit } from 'unist-util-visit';

/**
 * Maps editorial container directives (`:::name`) to semantic <aside> blocks.
 * Authors keep writing plain .md, with no MDX and no imports, and these directives
 * render as the brand's editorial blocks via global CSS (see BaseLayout.astro).
 *
 * Usage in any .md/.mdx post:
 *   :::problema-real
 *   En producción, el p99 se disparó a 4s.
 *   :::
 */
const BLOCKS = {
  'problema-real': 'Problema real',
  'la-trampa': 'La trampa',
  'la-decision': 'La decisión',
  'regla-senior': 'Regla senior',
  'checklist-produccion': 'Checklist de producción',
};

export function remarkEditorialBlocks() {
  return (tree) => {
    visit(tree, 'containerDirective', (node) => {
      const label = BLOCKS[node.name];
      if (!label) return;

      const data = node.data || (node.data = {});
      data.hName = 'aside';
      data.hProperties = {
        className: ['ed-block', `ed-${node.name}`],
        'data-label': label,
      };
    });
  };
}
