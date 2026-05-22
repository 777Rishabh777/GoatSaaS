/**
 * Email client using Resend.
 * Falls back to console.log when RESEND_API_KEY is not set (dev mode).
 */

export interface EmailRecord {
  id: string;
  timestamp: string;
  subject: string;
  segment: "all" | "free" | "pro" | "enterprise";
  recipientCount: number;
  status: "sent" | "failed" | "scheduled";
  scheduledFor?: string;
  body: string;
  sentBy: string;
}

// In-memory email send history
const EMAIL_HISTORY: EmailRecord[] = [
  {
    id: "em_001",
    timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
    subject: "🚀 GOATSaaS v2.0 — AI Analyst is live!",
    segment: "all",
    recipientCount: 5128,
    status: "sent",
    body: "We're excited to announce the launch of the AI Business Analyst feature...",
    sentBy: "admin@goatsaas.com",
  },
  {
    id: "em_002",
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
    subject: "⚡ Pro Plan: Exclusive early access to NL→SQL Direct Execution",
    segment: "pro",
    recipientCount: 1840,
    status: "sent",
    body: "As a Pro subscriber, you now have access to direct database execution...",
    sentBy: "admin@goatsaas.com",
  },
];

let emailCounter = 3;

async function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  try {
    const { Resend } = await import("resend");
    return new Resend(apiKey);
  } catch {
    return null;
  }
}

export async function sendBroadcastEmail(opts: {
  subject: string;
  body: string;
  segment: "all" | "free" | "pro" | "enterprise";
  sentBy: string;
  recipientEmails: string[];
  scheduledFor?: string;
}): Promise<{ success: boolean; recordId: string; error?: string }> {
  const record: EmailRecord = {
    id: `em_${String(emailCounter++).padStart(3, "0")}`,
    timestamp: new Date().toISOString(),
    subject: opts.subject,
    segment: opts.segment,
    recipientCount: opts.recipientEmails.length,
    status: "sent",
    body: opts.body,
    sentBy: opts.sentBy,
    scheduledFor: opts.scheduledFor,
  };

  try {
    const resend = await getResend();
    if (!resend) {
      // Dev mode — just log
      console.log(`[Email] BROADCAST (dev mode, no RESEND_API_KEY)\nTo: ${opts.recipientEmails.length} ${opts.segment} users\nSubject: ${opts.subject}\n`);
      EMAIL_HISTORY.push(record);
      return { success: true, recordId: record.id };
    }

    // Send via Resend (batch)
    for (const email of opts.recipientEmails.slice(0, 10)) { // safety cap for demo
      await resend.emails.send({
        from: "GOATSaaS <noreply@goatsaas.com>",
        to: email,
        subject: opts.subject,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #040408; color: #e4e4e7;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 32px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #7c3aed, #2563eb); display: flex; align-items: center; justify-content: center; font-weight: 900; color: white; font-size: 18px;">G</div>
              <span style="font-weight: 800; font-size: 18px; color: white;">GOAT<span style="color: #a78bfa;">SaaS</span></span>
            </div>
            <h1 style="font-size: 24px; font-weight: 700; color: white; margin-bottom: 16px;">${opts.subject}</h1>
            <div style="font-size: 15px; color: #a1a1aa; line-height: 1.7; white-space: pre-wrap;">${opts.body}</div>
            <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #27272a; font-size: 12px; color: #52525b;">
              You received this email because you're a ${opts.segment === "all" ? "" : opts.segment + " plan "}GOATSaaS user.
              <a href="#" style="color: #8b5cf6;">Unsubscribe</a>
            </div>
          </div>
        `,
      });
    }

    EMAIL_HISTORY.push(record);
    return { success: true, recordId: record.id };
  } catch (err: any) {
    record.status = "failed";
    EMAIL_HISTORY.push(record);
    return { success: false, recordId: record.id, error: err.message };
  }
}

export function getEmailHistory(): EmailRecord[] {
  return [...EMAIL_HISTORY].reverse();
}

export async function sendInviteEmail(opts: {
  toEmail: string;
  orgName: string;
  inviterName: string;
  role: string;
  inviteId: string;
}): Promise<{ success: boolean }> {
  try {
    const resend = await getResend();
    if (!resend) {
      console.log(`[Email] INVITE (dev mode) → ${opts.toEmail} invited to ${opts.orgName} as ${opts.role}`);
      return { success: true };
    }
    await resend.emails.send({
      from: "GOATSaaS <noreply@goatsaas.com>",
      to: opts.toEmail,
      subject: `${opts.inviterName} invited you to join ${opts.orgName} on GOATSaaS`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 540px; margin: 0 auto; padding: 40px 20px; background: #040408; color: #e4e4e7;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #7c3aed, #2563eb); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: white; font-size: 24px;">G</div>
            <h1 style="font-size: 22px; font-weight: 700; color: white;">You're invited to <span style="color: #a78bfa;">${opts.orgName}</span></h1>
            <p style="color: #a1a1aa; margin-top: 8px;">${opts.inviterName} has invited you to join as a ${opts.role}.</p>
          </div>
          <div style="text-align: center; margin-top: 32px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/sign-up?invite=${opts.inviteId}" 
               style="background: linear-gradient(135deg, #7c3aed, #2563eb); color: white; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 12px; text-decoration: none; display: inline-block;">
              Accept Invitation →
            </a>
          </div>
          <p style="margin-top: 32px; font-size: 12px; color: #52525b; text-align: center;">If you didn't expect this invite, you can safely ignore this email.</p>
        </div>
      `,
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}
