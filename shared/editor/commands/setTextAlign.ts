import type { Command } from "prosemirror-state";

/** Block types that support the align attribute. */
const alignableTypes = ["paragraph", "heading"];

/**
 * Returns a command that sets the text alignment of the selected paragraphs
 * and headings (a ValeOS addition).
 *
 * @param align - "center" or "right", or null for the default alignment.
 * @returns a prosemirror command.
 */
export function setTextAlign(align: string | null): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    const tr = state.tr;
    let applied = false;

    state.doc.nodesBetween(from, to, (node, pos) => {
      if (alignableTypes.includes(node.type.name)) {
        applied = true;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, align });
      }
    });

    if (!applied) {
      return false;
    }
    dispatch?.(tr);
    return true;
  };
}
