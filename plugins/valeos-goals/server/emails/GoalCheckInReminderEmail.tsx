import * as React from "react";
import type { EmailProps } from "@server/emails/templates/BaseEmail";
import BaseEmail, {
  EmailMessageCategory,
} from "@server/emails/templates/BaseEmail";
import Body from "@server/emails/templates/components/Body";
import Button from "@server/emails/templates/components/Button";
import EmailTemplate from "@server/emails/templates/components/EmailLayout";
import EmptySpace from "@server/emails/templates/components/EmptySpace";
import Footer from "@server/emails/templates/components/Footer";
import Header from "@server/emails/templates/components/Header";
import Heading from "@server/emails/templates/components/Heading";
import { KeyResultType } from "../../shared/types";

/** A key result waiting for a check-in, flattened so it survives the queue. */
export type ReminderKeyResult = {
  title: string;
  objectiveTitle: string;
  type: KeyResultType;
  currentValue: number;
  targetValue: number;
  unit: string | null;
};

type Props = EmailProps & {
  name: string;
  teamUrl: string;
  keyResults: ReminderKeyResult[];
};

const numberFormat = new Intl.NumberFormat("en", {
  maximumFractionDigits: 2,
});

/**
 * Email sent on Monday morning to a key result owner listing the key results
 * that have not had a check-in in the last week.
 */
export class GoalCheckInReminderEmail extends BaseEmail<Props> {
  protected get category() {
    return EmailMessageCategory.Notification;
  }

  protected subject() {
    return this.t("Your key results are waiting for a check-in");
  }

  protected preview({ keyResults }: Props) {
    return keyResults.length === 1
      ? this.t("One of your key results has not had a check-in this week.")
      : this.t(
          "{{ count }} of your key results have not had a check-in this week.",
          { count: keyResults.length }
        );
  }

  /**
   * Describes where a key result is up to, for example "412 of 450 people".
   *
   * @param keyResult - the key result.
   * @returns a short progress description.
   */
  protected progressText(keyResult: ReminderKeyResult) {
    if (keyResult.type === KeyResultType.Milestone) {
      return keyResult.currentValue >= 1
        ? this.t("Done")
        : this.t("Not done yet");
    }
    const unit = keyResult.unit
      ? keyResult.unit === "%"
        ? "%"
        : ` ${keyResult.unit}`
      : "";
    return this.t("{{ current }} of {{ target }}{{ unit }}", {
      current: numberFormat.format(keyResult.currentValue),
      target: numberFormat.format(keyResult.targetValue),
      unit,
    });
  }

  protected checkInUrl(teamUrl: string) {
    return `${teamUrl}/goals?view=mine`;
  }

  protected renderAsText({ name, teamUrl, keyResults }: Props): string {
    const list = keyResults
      .map(
        (kr) =>
          `- ${kr.title}\n  ${kr.objectiveTitle} · ${this.progressText(kr)}`
      )
      .join("\n");

    return `
${this.t("Hi {{ name }},", { name })}

${this.t("These key results have not had a check-in in the last week. A quick update helps everyone see how things are going.")}

${list}

${this.t("Check in")}: ${this.checkInUrl(teamUrl)}
`;
  }

  protected render(props: Props) {
    const { name, teamUrl, keyResults } = props;
    const rowStyle: React.CSSProperties = {
      padding: "10px 0",
      borderBottom: "1px solid #e6e8eb",
    };
    const metaStyle: React.CSSProperties = {
      color: "#6b7280",
      fontSize: "14px",
    };

    return (
      <EmailTemplate previewText={this.preview(props)}>
        <Header />

        <Body>
          <Heading>{this.t("Time for your weekly check-in")}</Heading>
          <p>{this.t("Hi {{ name }},", { name })}</p>
          <p>
            {this.t(
              "These key results have not had a check-in in the last week. A quick update helps everyone see how things are going."
            )}
          </p>
          <EmptySpace height={10} />
          {keyResults.map((kr, index) => (
            <div key={index} style={rowStyle}>
              <div style={{ fontWeight: 500 }}>{kr.title}</div>
              <div style={metaStyle}>
                {kr.objectiveTitle} · {this.progressText(kr)}
              </div>
            </div>
          ))}
          <EmptySpace height={20} />
          <p>
            <Button href={this.checkInUrl(teamUrl)}>
              {this.t("Check in")}
            </Button>
          </p>
        </Body>

        <Footer />
      </EmailTemplate>
    );
  }
}
