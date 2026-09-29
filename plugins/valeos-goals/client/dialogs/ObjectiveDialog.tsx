import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { errToString } from "@shared/utils/error";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import type { Option } from "~/components/InputSelect";
import { InputSelect } from "~/components/InputSelect";
import { canAlign } from "../../shared/progress";
import type { GoalObjectiveJSON } from "../../shared/types";
import { GoalLevel, GoalValidation } from "../../shared/types";
import { goalsApi } from "../api";
import { FieldSpacing, Segmented } from "../components/fields";
import { userOptions } from "../components/userOptions";
import type { GoalsIndex } from "../useGoals";

interface Props {
  index: GoalsIndex;
  currentUserId: string;
  isAdmin: boolean;
  /** The objective to edit; omit to create one. */
  objective?: GoalObjectiveJSON;
  /** The level preselected when creating. */
  defaultLevel?: GoalLevel;
  /** The group preselected when creating a team objective. */
  defaultGroupId?: string;
  /** Called with the saved objective and whether it was just created. */
  onSaved: (objective: GoalObjectiveJSON, created: boolean) => void;
}

const None = "none";

/**
 * Creates or edits an objective: what it is, whose it is, and what it
 * supports.
 */
export function ObjectiveDialog({
  index,
  currentUserId,
  isAdmin,
  objective,
  defaultLevel,
  defaultGroupId,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const { data, groupsById } = index;
  const allowed = data.abilities.createObjective;
  const firstAllowed =
    [GoalLevel.Team, GoalLevel.Personal, GoalLevel.Church].find(
      (level) => allowed[level]
    ) ?? GoalLevel.Personal;

  const [title, setTitle] = React.useState(objective?.title ?? "");
  const [description, setDescription] = React.useState(
    objective?.description ?? ""
  );
  const [level, setLevel] = React.useState<GoalLevel>(
    objective?.level ??
      (defaultLevel && allowed[defaultLevel] ? defaultLevel : firstAllowed)
  );
  const [groupId, setGroupId] = React.useState(
    objective?.groupId ?? defaultGroupId ?? data.groups[0]?.id ?? ""
  );
  const [ownerId, setOwnerId] = React.useState(
    objective?.ownerId ?? currentUserId
  );
  const [parentId, setParentId] = React.useState(objective?.parentId ?? None);
  const [isSaving, setIsSaving] = React.useState(false);

  const ownerLocked = level === GoalLevel.Personal && !isAdmin;
  const effectiveOwnerId = ownerLocked
    ? (objective?.ownerId ?? currentUserId)
    : ownerId;

  const parentOptions = React.useMemo<Option[]>(() => {
    const eligible = data.objectives.filter(
      (o) => o.id !== objective?.id && canAlign(level, o.level)
    );
    const options: Option[] = [
      { type: "item", label: t("Nothing yet"), value: None },
    ];
    const church = eligible.filter((o) => o.level === GoalLevel.Church);
    const team = eligible.filter((o) => o.level === GoalLevel.Team);
    if (church.length) {
      options.push({ type: "heading", label: t("Church") });
      church.forEach((o) =>
        options.push({ type: "item", label: o.title, value: o.id })
      );
    }
    if (team.length) {
      options.push({ type: "heading", label: t("Teams") });
      team.forEach((o) =>
        options.push({
          type: "item",
          label: o.title,
          description: o.groupId ? groupsById.get(o.groupId)?.name : undefined,
          value: o.id,
        })
      );
    }
    return options;
  }, [data.objectives, groupsById, level, objective?.id, t]);

  // Drop an alignment that is no longer valid after the level changes.
  const effectiveParentId = parentOptions.some(
    (o) => o.type === "item" && o.value === parentId
  )
    ? parentId
    : None;

  const groupOptions = React.useMemo<Option[]>(
    () =>
      data.groups.map((g) => ({ type: "item", label: g.name, value: g.id })),
    [data.groups]
  );

  const ownerSelectOptions = React.useMemo(
    () => userOptions(data.users),
    [data.users]
  );

  const levelOptions = [
    { value: GoalLevel.Church, label: t("Church") },
    { value: GoalLevel.Team, label: t("Team") },
    { value: GoalLevel.Personal, label: t("Personal") },
  ].map((option) => ({
    ...option,
    disabled: !allowed[option.value] && objective?.level !== option.value,
  }));

  const needsGroup = level === GoalLevel.Team;
  const canSubmit =
    !isSaving && title.trim() !== "" && (!needsGroup || groupId !== "");

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!canSubmit) {
      return;
    }
    setIsSaving(true);
    try {
      const input = {
        level,
        title: title.trim(),
        description: description.trim() || null,
        ownerId: effectiveOwnerId,
        groupId: needsGroup ? groupId : null,
        parentId: effectiveParentId === None ? null : effectiveParentId,
      };
      const saved = objective
        ? await goalsApi.updateObjective(objective.id, input)
        : await goalsApi.createObjective({
            cycleId: data.cycle?.id ?? "",
            ...input,
          });
      toast.success(objective ? t("Objective saved") : t("Objective created"));
      onSaved(saved, !objective);
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
        label={t("Objective")}
        placeholder={t("What do you want to achieve this cycle?")}
        value={title}
        onChange={(ev) => setTitle(ev.target.value)}
        maxLength={GoalValidation.maxTitleLength}
        required
        autoFocus
        flex
      />
      <Input
        type="textarea"
        label={t("Why it matters (optional)")}
        value={description}
        onChange={(ev) => setDescription(ev.target.value)}
        maxLength={GoalValidation.maxDescriptionLength}
        rows={2}
        autoSize
        maxHeight="10lh"
      />
      <Segmented
        label={t("Level")}
        value={level}
        onChange={setLevel}
        options={levelOptions}
      />
      {needsGroup &&
        (data.groups.length ? (
          <FieldSpacing>
            <InputSelect
              label={t("Team")}
              options={groupOptions}
              value={groupId}
              onChange={setGroupId}
            />
          </FieldSpacing>
        ) : (
          <p>
            {t(
              "Team objectives belong to a group. Ask an admin to create groups in Settings first."
            )}
          </p>
        ))}
      {!ownerLocked && (
        <FieldSpacing>
          <InputSelect
            label={t("Owner")}
            options={ownerSelectOptions}
            value={ownerId}
            onChange={setOwnerId}
          />
        </FieldSpacing>
      )}
      {level !== GoalLevel.Church && (
        <FieldSpacing>
          <InputSelect
            label={t("Supports")}
            options={parentOptions}
            value={effectiveParentId}
            onChange={setParentId}
            help={t("The higher-level objective this one helps achieve.")}
          />
        </FieldSpacing>
      )}
      <Flex justify="flex-end" style={{ marginTop: 8 }}>
        <Button type="submit" disabled={!canSubmit}>
          {isSaving
            ? `${t("Saving")}…`
            : objective
              ? t("Save changes")
              : t("Create objective")}
        </Button>
      </Flex>
    </form>
  );
}
