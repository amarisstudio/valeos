import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import { s } from "@shared/styles";
import { errToString } from "@shared/utils/error";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import type { GoalKeyResultJSON } from "../../shared/types";
import { GoalStatus, GoalValidation, KeyResultType } from "../../shared/types";
import { goalsApi } from "../api";
import { NativeField, Segmented } from "../components/fields";
import { StatusDot } from "../components/StatusLabel";
import { formatValue } from "../format";

interface Props {
  keyResult: GoalKeyResultJSON;
  /** Called after the check-in is saved. */
  onSaved: () => void;
}

/**
 * Records a new value, status and optional note for a key result.
 */
export function CheckInDialog({ keyResult, onSaved }: Props) {
  const { t } = useTranslation();
  const isMilestone = keyResult.type === KeyResultType.Milestone;
  const [value, setValue] = React.useState(String(keyResult.currentValue));
  const [done, setDone] = React.useState<"yes" | "no">(
    keyResult.currentValue >= 1 ? "yes" : "no"
  );
  const [status, setStatus] = React.useState<GoalStatus>(
    keyResult.status ?? GoalStatus.OnTrack
  );
  const [note, setNote] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const numericValue = isMilestone ? (done === "yes" ? 1 : 0) : Number(value);
  const valid = isMilestone || (value.trim() !== "" && isFinite(numericValue));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!valid) {
      return;
    }
    setIsSaving(true);
    try {
      await goalsApi.createCheckIn({
        keyResultId: keyResult.id,
        value: numericValue,
        status,
        note: note.trim() || null,
      });
      toast.success(t("Check-in saved"));
      onSaved();
    } catch (err) {
      toast.error(errToString(err));
    } finally {
      setIsSaving(false);
    }
  };

  const statusOptions = [
    { value: GoalStatus.OnTrack, label: t("On track") },
    { value: GoalStatus.AtRisk, label: t("At risk") },
    { value: GoalStatus.OffTrack, label: t("Off track") },
  ].map((option) => ({
    value: option.value,
    label: (
      <>
        <StatusDot $status={option.value} aria-hidden />
        {option.label}
      </>
    ),
  }));

  return (
    <form onSubmit={handleSubmit}>
      <Title>{keyResult.title}</Title>
      {isMilestone ? (
        <Segmented
          label={t("Progress")}
          value={done}
          onChange={setDone}
          options={[
            { value: "no", label: t("Not done yet") },
            { value: "yes", label: t("Done") },
          ]}
        />
      ) : (
        <>
          <NativeField
            type="number"
            step="any"
            label={
              keyResult.unit
                ? t("New value ({{ unit }})", { unit: keyResult.unit })
                : t("New value")
            }
            value={value}
            onChange={setValue}
            required
            autoFocus
          />
          <Hint>
            {t("Started at {{ start }}, aiming for {{ target }}.", {
              start: formatValue(keyResult.startValue, keyResult.unit),
              target: formatValue(keyResult.targetValue, keyResult.unit),
            })}
          </Hint>
        </>
      )}
      <Segmented
        label={t("How is it tracking?")}
        value={status}
        onChange={setStatus}
        options={statusOptions}
      />
      <Input
        type="textarea"
        label={t("What’s changed? (optional)")}
        placeholder={t("A sentence or two for the team")}
        value={note}
        onChange={(ev) => setNote(ev.target.value)}
        maxLength={GoalValidation.maxNoteLength}
        rows={3}
        autoSize
        maxHeight="12lh"
      />
      <Flex justify="flex-end">
        <Button type="submit" disabled={isSaving || !valid}>
          {isSaving ? `${t("Saving")}…` : t("Save check-in")}
        </Button>
      </Flex>
    </form>
  );
}

const Title = styled.p`
  margin: 0 0 16px;
  font-weight: 500;
  color: ${s("textSecondary")};
`;

const Hint = styled.p`
  margin: -8px 0 16px;
  font-size: 13px;
  color: ${s("textTertiary")};
`;
