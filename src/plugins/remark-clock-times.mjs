import { visit } from 'unist-util-visit';

/**
 * Undoes remark-directive's mis-parse of a time of day.
 *
 * `remarkDirective` is applied to every markdown file on the site
 * (astro.config.mjs) because the blog's editorial blocks (`:::regla-senior`)
 * need it. Its *text* directive syntax is `:name`, so in "el corte es a las
 * 23:56" the `:56` is parsed as a directive named `56`. The minutes are
 * deleted from the page, the surrounding `<p>`/`<em>` are torn apart, and an
 * empty `<div>` is left where the number used to be.
 *
 * That is not cosmetic. In `n12-trap-la-copia-del-catalogo-que-pide-comercial`
 * the brief says "El dato que decide es este: el proveedor publica la lista
 * una sola vez por día, a las 06:00", and the player was reading "a las 06".
 *
 * The rule: a text directive whose name is only digits is never an editorial
 * block (every block in remark-editorial-blocks.mjs is named with letters), so
 * it is a mis-parsed clock time. The node is replaced by the exact source
 * slice it came from, using position offsets rather than a reconstruction, so whatever
 * the directive swallowed (a `[label]`, a `{attribute}`) comes back verbatim.
 *
 * Must run after `remarkDirective` in the plugin list. `:::` container
 * directives and letter-named text directives are untouched.
 */
const DIGITS_ONLY = /^\d+$/;

export function remarkClockTimes() {
  return (tree, file) => {
    const source = String(file.value ?? '');

    visit(tree, 'textDirective', (node, index, parent) => {
      if (!parent || index === null || index === undefined) return;
      if (!DIGITS_ONLY.test(node.name)) return;

      const start = node.position?.start?.offset;
      const end = node.position?.end?.offset;
      // No positions means no source to restore from, and leaving the node alone
      // is worse than a best-effort `:name`, which is exactly what was typed.
      const raw = start === undefined || end === undefined ? `:${node.name}` : source.slice(start, end);

      parent.children[index] = { type: 'text', value: raw, position: node.position };
    });
  };
}
