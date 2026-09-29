import { EditIcon, PlusIcon, TrashIcon } from "outline-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DropdownMenu } from "~/components/Menu/DropdownMenu";
import { OverflowMenuButton } from "~/components/Menu/OverflowMenuButton";
import { ActionSeparator, createAction } from "~/actions";
import { useMenuAction } from "~/hooks/useMenuAction";

interface Props {
  /** Accessible name for the menu. */
  ariaLabel: string;
  onEdit?: () => void;
  onAddKeyResult?: () => void;
  onDelete?: () => void;
}

const Section = "Goals";

/**
 * The overflow menu on an objective or key result. Items without a handler
 * are hidden, and the menu disappears entirely when there are none.
 */
export function ItemMenu({
  ariaLabel,
  onEdit,
  onAddKeyResult,
  onDelete,
}: Props) {
  const { t } = useTranslation();

  const actions = useMemo(
    () => [
      createAction({
        name: `${t("Edit")}…`,
        icon: <EditIcon />,
        section: Section,
        visible: !!onEdit,
        perform: () => onEdit?.(),
      }),
      createAction({
        name: `${t("Add key result")}…`,
        icon: <PlusIcon />,
        section: Section,
        visible: !!onAddKeyResult,
        perform: () => onAddKeyResult?.(),
      }),
      ActionSeparator,
      createAction({
        name: `${t("Delete")}…`,
        icon: <TrashIcon />,
        section: Section,
        dangerous: true,
        visible: !!onDelete,
        perform: () => onDelete?.(),
      }),
    ],
    [t, onEdit, onAddKeyResult, onDelete]
  );

  const rootAction = useMenuAction(actions);

  if (!onEdit && !onAddKeyResult && !onDelete) {
    return null;
  }

  return (
    <DropdownMenu action={rootAction} align="end" ariaLabel={ariaLabel}>
      <OverflowMenuButton />
    </DropdownMenu>
  );
}
