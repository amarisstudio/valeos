import type { MarkSpec } from "prosemirror-model";
import { validateColorHex } from "@shared/utils/color";
import Mark from "./Mark";

/** A named preset color for colored text. */
export interface TextColorPreset {
  hex: string;
  name: string;
}

/**
 * Colored text (a ValeOS addition). The same shape as Highlight but applied to
 * the foreground. Colors are stored as a hex attribute and rendered inline, so
 * they survive editing and version history; plain markdown export keeps the
 * text and drops the color, as markdown has no syntax for it.
 */
export default class TextColor extends Mark {
  /** Preset colors, chosen to stay legible on both light and dark themes. */
  static presetColors: TextColorPreset[] = [
    { hex: "#E5484D", name: "Red" },
    { hex: "#F76B15", name: "Orange" },
    { hex: "#E79D13", name: "Amber" },
    { hex: "#30A46C", name: "Green" },
    { hex: "#0091FF", name: "Blue" },
    { hex: "#8E4EC6", name: "Purple" },
    { hex: "#D6409F", name: "Pink" },
    { hex: "#8D8D8D", name: "Gray" },
  ];

  /**
   * Checks if a color is one of the text color presets.
   *
   * @param color - A hex color string to check.
   * @returns true if the color matches a preset color's hex value.
   */
  static isPresetColor(color: string): boolean {
    return TextColor.presetColors.some((c) => c.hex === color);
  }

  get name() {
    return "text_color";
  }

  get schema(): MarkSpec {
    return {
      attrs: {
        color: {
          default: null,
          validate: "string|null",
        },
      },
      parseDOM: [
        {
          tag: "span[data-text-color]",
          getAttrs: (dom) => {
            const color = dom.getAttribute("data-text-color") || "";
            return validateColorHex(color) ? { color } : false;
          },
        },
      ],
      toDOM: (node) => {
        const color = validateColorHex(node.attrs.color ?? "")
          ? node.attrs.color
          : null;

        return [
          "span",
          {
            "data-text-color": color,
            style: color ? `color: ${color}` : "",
          },
        ];
      },
    };
  }

  toMarkdown() {
    return {
      open: "",
      close: "",
      mixable: true,
      expelEnclosingWhitespace: true,
    };
  }
}
