import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { errToString } from "@shared/utils/error";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import type { GoalCycleJSON } from "../../shared/types";
import { GoalValidation } from "../../shared/types";
import { goalsApi } from "../api";
import { NativeField } from "../components/fields";
import { toDay } from "../format";

interface Props {
  /** The cycle to edit; omit to create one. */
  cycle?: GoalCycleJSON;
  /** Called with the saved cycle. */
  onSaved: (cycle: GoalCycleJSON) => void;
}

const TwelveWeeksMs = 12 * 7 * 24 * 60 * 60 * 1000;

/**
 * Creates or edits a goal cycle: a name and a date range.
 */
export function CycleDialog({ cycle, onSaved }: Props) {
  const { t } = useTranslation();
  const [name, setName] = React.useState(cycle?.name ?? "");
  const [startsAt, setStartsAt] = React.useState(
    () => cycle?.startsAt ?? toDay(new Date())
  );
  const [endsAt, setEndsAt] = React.useState(
    () => cycle?.endsAt ?? toDay(new Date(Date.now() + TwelveWeeksMs))
  );
  const [isSaving, setIsSaving] = React.useState(false);

  const rangeError =
    startsAt && endsAt && endsAt < startsAt
      ? t("The end date needs to be on or after the start date.")
      : undefined;

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (rangeError) {
      return;
    }
    setIsSaving(true);
    try {
      const input = { name: name.trim(), startsAt, endsAt };
      const saved = cycle
        ? await goalsApi.updateCycle(cycle.id, input)
        : await goalsApi.createCycle(input);
      toast.success(cycle ? t("Cycle saved") : t("Cycle created"));
      onSaved(saved);
    } catch (err) {
      toast.error(errToString(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        type="text"
        label={t("Name")}
        placeholder={t("Term 4 2026")}
        value={name}
        onChange={(ev) => setName(ev.target.value)}
        maxLength={GoalValidation.maxCycleNameLength}
        required
        autoFocus
        flex
      />
      <Flex gap={12}>
        <NativeField
          type="date"
          label={t("Starts")}
          value={startsAt}
          onChange={setStartsAt}
          required
        />
        <NativeField
          type="date"
          label={t("Ends")}
          value={endsAt}
          min={startsAt}
          onChange={setEndsAt}
          required
        />
      </Flex>
      <Flex justify="flex-end">
        <Button
          type="submit"
          disabled={isSaving || !name.trim() || !!rangeError}
        >
          {isSaving
            ? `${t("Saving")}…`
            : cycle
              ? t("Save changes")
              : t("Create cycle")}
        </Button>
      </Flex>
    </form>
  );
}
