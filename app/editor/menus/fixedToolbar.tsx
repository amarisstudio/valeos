import {
  BlockQuoteIcon,
  BoldIcon,
  BulletedListIcon,
  CaretDownIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlightIcon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  StrikethroughIcon,
  TodoListIcon,
} from "outline-icons";
import { t } from "i18next";
import type { EditorState } from "prosemirror-state";
import { isListActive } from "@shared/editor/queries/isListActive";
import { isMarkActive } from "@shared/editor/queries/isMarkActive";
import { isNodeActive } from "@shared/editor/queries/isNodeActive";
import {
  MenuItemGroup,
  type MenuItem,
  type SelectionContext,
} from "@shared/editor/types";
import { metaDisplay } from "@shared/utils/keyboard";

/**
 * Returns the block type choices for the fixed toolbar's dropdown, Notion
 * style: one menu that both names the current block and converts it.
 *
 * @param ctx - the current selection context.
 * @returns an array of menu items.
 */
function blockTypeItems(ctx: SelectionContext): MenuItem[] {
  const { schema } = ctx;

  return [
    {
      name: "paragraph",
      group: MenuItemGroup.block,
      label: t("Text"),
      icon: <BlockQuoteIcon style={{ visibility: "hidden" }} />,
      active: (state: EditorState) =>
        isNodeActive(schema.nodes.paragraph)(state) &&
        !isListActive(schema.nodes.bullet_list)(state) &&
        !isListActive(schema.nodes.ordered_list)(state) &&
        !isListActive(schema.nodes.checkbox_list)(state) &&
        !isNodeActive(schema.nodes.blockquote)(state),
    },
    {
      name: "heading",
      group: MenuItemGroup.block,
      label: t("Heading"),
      icon: <Heading1Icon />,
      attrs: { level: 1 },
      active: isNodeActive(schema.nodes.heading, { level: 1 }),
    },
    {
      name: "heading",
      group: MenuItemGroup.block,
      label: t("Subheading"),
      icon: <Heading2Icon />,
      attrs: { level: 2 },
      active: isNodeActive(schema.nodes.heading, { level: 2 }),
    },
    {
      name: "heading",
      group: MenuItemGroup.block,
      label: t("Small heading"),
      icon: <Heading3Icon />,
      attrs: { level: 3 },
      active: isNodeActive(schema.nodes.heading, { level: 3 }),
    },
    {
      name: "bullet_list",
      group: MenuItemGroup.block,
      label: t("Bulleted list"),
      icon: <BulletedListIcon />,
      active: isListActive(schema.nodes.bullet_list),
    },
    {
      name: "ordered_list",
      group: MenuItemGroup.block,
      label: t("Ordered list"),
      icon: <OrderedListIcon />,
      active: isListActive(schema.nodes.ordered_list),
    },
    {
      name: "checkbox_list",
      group: MenuItemGroup.block,
      label: t("Todo list"),
      icon: <TodoListIcon />,
      active: isListActive(schema.nodes.checkbox_list),
    },
    {
      name: "blockquote",
      group: MenuItemGroup.block,
      label: t("Quote"),
      icon: <BlockQuoteIcon />,
      active: isNodeActive(schema.nodes.blockquote),
    },
  ];
}

/**
 * Returns menu items for the always-visible formatting toolbar (a ValeOS
 * addition). A deliberately small set of recognizable controls for people who
 * have never used a markdown editor: a Notion-style block type dropdown that
 * names the current block, then inline marks, then link.
 *
 * @param ctx - the current selection context.
 * @returns an array of menu items.
 */
export default function fixedToolbarMenuItems(
  ctx: SelectionContext
): MenuItem[] {
  const { schema, state, isInCodeBlock } = ctx;
  const canFormat = !isInCodeBlock;

  const blockTypes = blockTypeItems(ctx);
  const current = blockTypes.find((item) => item.active?.(state));

  return [
    {
      label: current?.label ?? t("Text"),
      tooltip: t("Change block type"),
      icon: <CaretDownIcon />,
      disabled: !canFormat,
      children: blockTypes,
    },
    {
      name: "separator",
    },
    {
      name: "strong",
      group: MenuItemGroup.inline,
      tooltip: t("Bold"),
      shortcut: `${metaDisplay}+B`,
      icon: <BoldIcon />,
      active: isMarkActive(schema.marks.strong),
      disabled: !canFormat,
    },
    {
      name: "em",
      group: MenuItemGroup.inline,
      tooltip: t("Italic"),
      shortcut: `${metaDisplay}+I`,
      icon: <ItalicIcon />,
      active: isMarkActive(schema.marks.em),
      disabled: !canFormat,
    },
    {
      name: "strikethrough",
      group: MenuItemGroup.inline,
      tooltip: t("Strikethrough"),
      shortcut: `${metaDisplay}+D`,
      icon: <StrikethroughIcon />,
      active: isMarkActive(schema.marks.strikethrough),
      disabled: !canFormat,
    },
    {
      name: "highlight",
      group: MenuItemGroup.inline,
      tooltip: t("Highlight"),
      shortcut: `⇧+Ctrl+H`,
      icon: <HighlightIcon />,
      active: isMarkActive(schema.marks.highlight),
      disabled: !canFormat,
    },
    {
      name: "separator",
    },
    {
      name: "addLink",
      group: MenuItemGroup.inline,
      tooltip: t("Create link"),
      shortcut: `${metaDisplay}+K`,
      icon: <LinkIcon />,
      attrs: { href: "" },
      active: isMarkActive(schema.marks.link),
      disabled: !canFormat || ctx.isEmpty,
    },
  ];
}
