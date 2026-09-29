import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import { s } from "@shared/styles";
import { errToString } from "@shared/utils/error";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import { InputSelect } from "~/components/InputSelect";
import type {
  GoalKeyResultJSON,
  GoalObjectiveJSON,
  GoalUserJSON,
} from "../../shared/types";
import { GoalValidation, KeyResultType } from "../../shared/types";
import { goalsApi } from "../api";
import { FieldSpacing, NativeField, Segmented } from "../components/fields";
import { userOptions } from "../components/userOptions";

interface Props {
  objective: GoalObjectiveJSON;
  users: GoalUserJSON[];
  /** The key result to edit; omit to add one. */
  keyResult?: GoalKeyResultJSON;
  /** Called after saving, with whether to open a fresh dialog for another. */
  onSaved: (addAnother: boolean) => void;
}

/**
 * Adds or edits a key result: a measurable number or a done-or-not
 * milestone, with an owner who checks in on it.
 */
export function KeyResultDialog({
  objective,
  users,
  keyResult,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = React.useState(keyResult?.title ?? "");
  const [type, setType] = React.useState<KeyResultType>(
    keyResult?.type ?? KeyResultType.Metric
  );
  const [startValue, setStartValue] = React.useState(
    keyResult ? String(keyResult.startValue) : "0"
  );
  const [targetValue, setTargetValue] = React.useState(
    keyResult ? String(keyResult.targetValue) : ""
  );
  const [unit, setUnit] = React.useState(keyResult?.unit ?? "");
  const [ownerId, setOwnerId] = React.useState(
    keyResult?.ownerId ?? objective.ownerId
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const addAnother = React.useRef(false);

  const isMetric = type === KeyResultType.Metric;
  const start = Number(startValue);
  const target = Number(targetValue);
  const metricError =
    isMetric && startValue !== "" && targetValue !== "" && start === target
      ? t("The target needs to be different from the starting value.")
      : undefined;
  const canSubmit =
    !isSaving &&
    title.trim() !== "" &&
    (!isMetric ||
      (startValue.trim() !== "" &&
        targetValue.trim() !== "" &&
        isFinite(start) &&
        isFinite(target) &&
        !metricError));

  const ownerSelectOptions = React.useMemo(() => userOptions(users), [users]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!canSubmit) {
      return;
    }
    setIsSaving(true);
    try {
      const input = {
        title: title.trim(),
        type,
        ownerId,
        ...(isMetric
          ? {
              startValue: start,
              targetValue: target,
              unit: unit.trim() || null,
            }
          : { unit: null }),
      };
      if (keyResult) {
        await goalsApi.updateKeyResult(keyResult.id, input);
      } else {
        await goalsApi.createKeyResult({ objectiveId: objective.id, ...input });
      }
      toast.success(keyResult ? t("Key result saved") : t("Key result added"));
      onSaved(addAnother.current);
    } catch (err) {
      toast.error(errToString(err));
    } finally {
      setIsSaving(false);
      addAnother.current = false;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Objective>{objective.title}</Objective>
      <Input
        type="text"
        label={t("Key result")}
        placeholder={
          isMetric
            ? t("Average Sunday attendance reaches 450")
            : t("Launch the new welcome team roster")
        }
        value={title}
        onChange={(ev) => setTitle(ev.target.value)}
        maxLength={GoalValidation.maxTitleLength}
        required
        autoFocus
        flex
      />
      <Segmented
        label={t("Measured by")}
        value={type}
        onChange={setType}
        options={[
          { value: KeyResultType.Metric, label: t("A number") },
          { value: KeyResultType.Milestone, label: t("Done or not") },
        ]}
      />
      {isMetric && (
        <>
          <Flex gap={12}>
            <NativeField
              type="number"
              step="any"
              label={t("Starting value")}
              value={startValue}
              onChange={setStartValue}
              required
            />
            <NativeField
              type="number"
              step="any"
              label={t("Target")}
              value={targetValue}
              onChange={setTargetValue}
              required
            />
            <Input
              type="text"
              label={t("Unit")}
              placeholder={t("people")}
              value={unit}
              onChange={(ev) => setUnit(ev.target.value)}
              maxLength={GoalValidation.maxUnitLength}
              flex
            />
          </Flex>
          {metricError && <ErrorText>{metricError}</ErrorText>}
        </>
      )}
      <FieldSpacing>
        <InputSelect
          label={t("Owner")}
          options={ownerSelectOptions}
          value={ownerId}
          onChange={setOwnerId}
          help={t("The owner posts the weekly check-in.")}
        />
      </FieldSpacing>
      <Flex justify="flex-end" gap={8} style={{ marginTop: 8 }}>
        {!keyResult && (
          <Button
            type="submit"
            neutral
            disabled={!canSubmit}
            onClick={() => {
              addAnother.current = true;
            }}
          >
            {t("Add and create another")}
          </Button>
        )}
        <Button type="submit" disabled={!canSubmit}>
          {isSaving
            ? `${t("Saving")}…`
            : keyResult
              ? t("Save changes")
              : t("Add key result")}
        </Button>
      </Flex>
    </form>
  );
}

const Objective = styled.p`
  margin: 0 0 16px;
  font-weight: 500;
  color: ${s("textSecondary")};
`;

const ErrorText = styled.p`
  margin: -8px 0 16px;
  font-size: 13px;
  color: ${s("danger")};
`;
