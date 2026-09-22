// SMTP -> Resend HTTPS relay. Railway blocks outbound SMTP on Free/Trial/Hobby
// plans, so Outline sends plain SMTP to this service over Railway's private
// network and the actual delivery happens over HTTPS via the Resend API.
//
// No auth: the service is reachable only on the project's private network
// (it binds IPv6, which is all Railway private networking routes; it has no
// public domain).
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not set; refusing to start");
  process.exit(1);
}
const PORT = Number(process.env.PORT || 2525);

const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS"],
  disableReverseLookup: true,
  onData(stream, session, callback) {
    simpleParser(stream)
      .then(async (mail) => {
        const payload = {
          from: mail.from?.text,
          to: session.envelope.rcptTo.map((r) => r.address),
          subject: mail.subject ?? "",
          html: mail.html || undefined,
          text: mail.text || undefined,
        };
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const body = await res.text();
        if (!res.ok) {
          throw new Error(`Resend ${res.status}: ${body}`);
        }
        console.log(`sent "${payload.subject}" to ${payload.to.join(", ")} (${body})`);
        callback();
      })
      .catch((err) => {
        console.error("relay failed:", err.message);
        callback(new Error("451 relay to Resend failed"));
      });
  },
});

server.on("error", (err) => console.error("smtp error:", err.message));
// "::" so the listener is reachable over Railway private networking, which is IPv6.
server.listen(PORT, "::", () => console.log(`mail bridge listening on [::]:${PORT}`));
