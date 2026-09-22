import { action, makeObservable, observable } from "mobx";
import { Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import * as React from "react";
import type { WidgetProps } from "@shared/editor/lib/Extension";
import Extension from "@shared/editor/lib/Extension";
import { FixedToolbar } from "../components/FixedToolbar";

/**
 * Renders the always-visible formatting toolbar (a ValeOS addition). The
 * observable version ticks on every editor transaction so the toolbar's
 * active and disabled states track the cursor.
 */
export default class FixedToolbarExtension extends Extension {
  get name() {
    return "fixed-toolbar";
  }

  get plugins(): Plugin[] {
    return [
      new Plugin({
        view: () => ({
          update: this.handleUpdate,
        }),
      }),
    ];
  }

  constructor(options: Partial<object> = {}) {
    super(options);
    makeObservable(this);
  }

  @observable
  version = 0;

  private handleUpdate = action((_view: EditorView) => {
    this.version += 1;
  });

  widget = (props: WidgetProps) => {
    // Read the observable so the editor's observer render re-runs the widget
    // on each transaction.
    void this.version;
    return <FixedToolbar rtl={props.rtl} readOnly={props.readOnly} />;
  };
}
