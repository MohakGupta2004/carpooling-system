import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { logger } from './logger.js';

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) {
    logger.warn({ to, subject }, 'SMTP not configured — skipping email send');
    return false;
  }
  try {
    await transporter.sendMail({ from: env.smtp.from, to, subject, html });
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, 'Failed to send email');
    return false;
  }
}

export function welcomeAccountEmail(opts: {
  fullName: string;
  email: string;
  password: string;
  loginUrl: string;
}) {
  return {
    subject: 'Your Workway account has been created',
    html: `
      <p>Hi ${opts.fullName},</p>
      <p>An account has been created for you on Workway. Here are your login credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${opts.email}</li>
        <li><strong>Temporary password:</strong> ${opts.password}</li>
      </ul>
      <p>Please log in and change your password as soon as possible: <a href="${opts.loginUrl}">${opts.loginUrl}</a></p>
      <p>— Workway</p>
    `,
  };
}
