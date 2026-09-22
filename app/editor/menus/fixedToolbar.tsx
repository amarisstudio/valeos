import {
  BlockQuoteIcon,
  BoldIcon,
  BulletedListIcon,
  Heading1Icon,
  Heading2Icon,
  HighlightIcon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  StrikethroughIcon,
  TodoListIcon,
} from "outline-icons";
import { t } from "i18next";
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
 * Returns menu items for the always-visible formatting toolbar (a ValeOS
 * addition). A deliberately small set of recognizable controls for people who
 * have never used a markdown editor: no dropdowns, no destructive actions.
 *
 * @param ctx - the current selection context.
 * @returns an array of menu items.
 */
export default function fixedToolbarMenuItems(
  ctx: SelectionContext
): MenuItem[] {
  const { schema, isInCodeBlock, isTableCell } = ctx;
  const canFormat = !isInCodeBlock;

  return [
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
      name: "heading",
      group: MenuItemGroup.block,
      tooltip: t("Heading"),
      shortcut: `⇧+Ctrl+1`,
      icon: <Heading1Icon />,
      active: isNodeActive(schema.nodes.heading, { level: 1 }),
      attrs: { level: 1 },
      disabled: !canFormat || isTableCell,
    },
    {
      name: "heading",
      group: MenuItemGroup.block,
      tooltip: t("Subheading"),
      shortcut: `⇧+Ctrl+2`,
      icon: <Heading2Icon />,
      active: isNodeActive(schema.nodes.heading, { level: 2 }),
      attrs: { level: 2 },
      disabled: !canFormat || isTableCell,
    },
    {
      name: "separator",
    },
    {
      name: "bullet_list",
      group: MenuItemGroup.block,
      tooltip: t("Bulleted list"),
      shortcut: `⇧+Ctrl+8`,
      icon: <BulletedListIcon />,
      active: isListActive(schema.nodes.bullet_list),
      disabled: !canFormat || isTableCell,
    },
    {
      name: "ordered_list",
      group: MenuItemGroup.block,
      tooltip: t("Ordered list"),
      shortcut: `⇧+Ctrl+9`,
      icon: <OrderedListIcon />,
      active: isListActive(schema.nodes.ordered_list),
      disabled: !canFormat || isTableCell,
    },
    {
      name: "checkbox_list",
      group: MenuItemGroup.block,
      tooltip: t("Todo list"),
      shortcut: `⇧+Ctrl+7`,
      icon: <TodoListIcon />,
      active: isListActive(schema.nodes.checkbox_list),
      disabled: !canFormat || isTableCell,
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
    {
      name: "blockquote",
      group: MenuItemGroup.block,
      tooltip: t("Quote"),
      shortcut: `${metaDisplay}+]`,
      icon: <BlockQuoteIcon />,
      active: isNodeActive(schema.nodes.blockquote),
      disabled: !canFormat || isTableCell,
    },
  ];
}
