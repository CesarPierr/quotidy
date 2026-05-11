import "server-only";

import nodemailer from "nodemailer";

import { logInfo } from "@/lib/logger";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "noreply@hearthly.local";

  if (!host) {
    // Dev fallback: log to console instead of sending
    return { transport: null as null, from };
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  return { transport, from };
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const { transport, from } = createTransport();

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Réinitialisation du mot de passe</h1>
      <p style="color: #555; margin-bottom: 24px;">
        Vous avez demandé à réinitialiser votre mot de passe makeMenage. Cliquez sur le bouton ci-dessous.
        Ce lien est valable pendant <strong>1 heure</strong>.
      </p>
      <a
        href="${resetUrl}"
        style="display: inline-block; background: #d95f3b; color: white; text-decoration: none;
               padding: 12px 24px; border-radius: 12px; font-weight: 600;"
      >
        Réinitialiser mon mot de passe
      </a>
      <p style="color: #888; font-size: 13px; margin-top: 24px;">
        Si vous n'avez pas fait cette demande, ignorez simplement cet email.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 12px;">makeMenage — gestion du foyer</p>
    </div>
  `;

  if (!transport) {
    // Dev mode: log to console
    logInfo("mailer.dev_mode", { email, resetUrl });
    return;
  }

  await transport.sendMail({
    from,
    to: email,
    subject: "Réinitialisation de votre mot de passe makeMenage",
    html,
    text: `Réinitialisez votre mot de passe : ${resetUrl}\n\nCe lien expire dans 1 heure.`,
  });
}
