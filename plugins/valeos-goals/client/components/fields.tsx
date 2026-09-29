import * as React from "react";
import styled from "styled-components";
import { s } from "@shared/styles";
import { LabelText, NativeInput, Outline, Wrapper } from "~/components/Input";

type NativeFieldProps = {
  label: string;
  type: "date" | "number";
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  min?: string;
  step?: string;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
};

/**
 * A date or number input styled to match Outline's Input, which only
 * supports text-like types.
 */
export function NativeField({
  label,
  type,
  value,
  onChange,
  ...rest
}: NativeFieldProps) {
  const [focused, setFocused] = React.useState(false);
  return (
    <Wrapper flex>
      <label>
        <LabelText>{label}</LabelText>
        <Outline $focused={focused}>
          <NativeInput
            type={type}
            value={value}
            inputMode={type === "number" ? "decimal" : undefined}
            onChange={(ev: React.ChangeEvent<HTMLInputElement>) =>
              onChange(ev.target.value)
            }
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...rest}
          />
        </Outline>
      </label>
    </Wrapper>
  );
}

/** Gives Outline's InputSelect the same bottom spacing as Input. */
export const FieldSpacing = styled.div`
  margin: 0 0 16px;
`;

export type SegmentOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
};

type SegmentedProps<T extends string> = {
  label: string;
  options: SegmentOption<NoInfer<T>>[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
};

/**
 * A row of mutually exclusive choices, used where a dropdown would hide
 * options people should compare at a glance.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.filter((o) => !o.disabled);

  const handleKeyDown = (ev: React.KeyboardEvent, current: T) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(ev.key)) {
      return;
    }
    ev.preventDefault();
    const step = ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : -1;
    const at = enabled.findIndex((o) => o.value === current);
    const next = enabled[(at + step + enabled.length) % enabled.length];
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };

  return (
    <Field>
      <LabelText id={`${label}-label`}>{label}</LabelText>
      <Group role="radiogroup" aria-labelledby={`${label}-label`}>
        {options.map((option, i) => {
          const checked = option.value === value;
          return (
            <Segment
              key={option.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              disabled={option.disabled}
              $checked={checked}
              onClick={() => onChange(option.value)}
              onKeyDown={(ev) => handleKeyDown(ev, option.value)}
            >
              {option.label}
            </Segment>
          );
        })}
      </Group>
    </Field>
  );
}

const Field = styled.div`
  margin: 0 0 16px;
`;

const Group = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  border: 1px solid ${s("inputBorder")};
  border-radius: 6px;
  width: fit-content;
  max-width: 100%;
`;

const Segment = styled.button<{ $checked: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: var(--pointer);
  color: ${(props) =>
    props.$checked ? props.theme.text : props.theme.textTertiary};
  background: ${(props) =>
    props.$checked ? props.theme.backgroundSecondary : "transparent"};

  &:hover:not(:disabled) {
    color: ${s("text")};
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid ${s("accent")};
    outline-offset: 1px;
  }
`;
