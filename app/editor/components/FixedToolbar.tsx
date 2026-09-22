import * as React from "react";
import styled from "styled-components";
import { buildSelectionContext } from "@shared/editor/lib/buildSelectionContext";
import { depths, s } from "@shared/styles";
import { HEADER_HEIGHT } from "~/components/Header";
import { Portal } from "~/components/Portal";
import useMobile from "~/hooks/useMobile";
import fixedToolbarMenuItems from "../menus/fixedToolbar";
import { useEditor } from "./EditorContext";
import ToolbarMenu from "./ToolbarMenu";

type Props = {
  /** Whether the text direction is right-to-left. */
  rtl: boolean;
  /** Whether the editor is in read-only mode. */
  readOnly?: boolean;
};

/**
 * An always-visible formatting toolbar pinned below the app header while a
 * document is being edited (a ValeOS addition). It exists for people who don't
 * know to select text first: the controls are permanently on screen, in the
 * same style as the selection toolbar. Hidden on mobile, where the selection
 * toolbar already docks above the on-screen keyboard.
 */
export function FixedToolbar(props: Props) {
  const { rtl, readOnly = false } = props;
  const { view, commands } = useEditor();
  const isMobile = useMobile();

  if (readOnly || isMobile) {
    return null;
  }

  const ctx = buildSelectionContext(view.state, {
    readOnly,
    isTemplate: false,
    rtl,
  });

  let items = fixedToolbarMenuItems(ctx);
  items = items.filter(
    (item) => item.name === "separator" || (item.name && commands[item.name])
  );

  if (!items.length) {
    return null;
  }

  return (
    <Portal>
      <Bar dir={rtl ? "rtl" : "ltr"}>
        <ToolbarMenu items={items} />
      </Bar>
    </Portal>
  );
}

const Bar = styled.div`
  position: fixed;
  top: ${HEADER_HEIGHT + 8}px;
  left: 50%;
  transform: translateX(-50%);
  z-index: ${depths.editorToolbar};
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 6px;
  background-color: ${s("menuBackground")};
  box-shadow: ${s("menuShadow")};
  border-radius: 4px;

  @media print {
    display: none;
  }
`;
