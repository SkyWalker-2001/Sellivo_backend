import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Pluggable SMS sender for phone OTPs. Provider is chosen via SMS_PROVIDER:
 *   - "textbelt" (default) — free/no-signup tier (key "textbelt" = ~1 SMS/day,
 *     shared globally); set SMS_TEXTBELT_KEY to a paid key for reliable delivery.
 *   - "twilio"   — set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM.
 *   - "console"  — no real SMS; the code is logged (and returned by the API as
 *     devCode) so a developer can sign in without a phone.
 */
export type SmsResult = { sent: boolean; provider: string; error?: string };

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  get provider(): string {
    return (this.config.get<string>("SMS_PROVIDER") ?? "textbelt").toLowerCase();
  }

  /** True when no real SMS is sent, so the API may surface the code for dev. */
  get isConsole(): boolean {
    return this.provider === "console";
  }

  async send(phone: string, message: string): Promise<SmsResult> {
    const provider = this.provider;
    try {
      switch (provider) {
        case "console":
          this.logger.warn(`[SMS:console] to ${phone}: ${message}`);
          return { sent: true, provider };
        case "twilio":
          return await this.sendTwilio(phone, message);
        case "textbelt":
        default:
          return await this.sendTextbelt(phone, message);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.logger.error(`SMS send failed via ${provider}: ${error}`);
      return { sent: false, provider, error };
    }
  }

  private async sendTextbelt(phone: string, message: string): Promise<SmsResult> {
    const key = this.config.get<string>("SMS_TEXTBELT_KEY") ?? "textbelt";
    const res = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ phone, message, key }),
    });
    const data = (await res.json()) as {
      success: boolean;
      quotaRemaining?: number;
      error?: string;
    };
    if (!data.success) {
      return { sent: false, provider: "textbelt", error: data.error ?? "send failed" };
    }
    this.logger.log(`Textbelt sent to ${phone} (quota left: ${data.quotaRemaining})`);
    return { sent: true, provider: "textbelt" };
  }

  private async sendTwilio(phone: string, message: string): Promise<SmsResult> {
    const sid = this.config.get<string>("TWILIO_ACCOUNT_SID");
    const token = this.config.get<string>("TWILIO_AUTH_TOKEN");
    const from = this.config.get<string>("TWILIO_FROM");
    if (!sid || !token || !from) {
      return { sent: false, provider: "twilio", error: "Twilio env not configured" };
    }
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        },
        body: new URLSearchParams({ To: phone, From: from, Body: message }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, provider: "twilio", error: `${res.status}: ${body}` };
    }
    this.logger.log(`Twilio sent to ${phone}`);
    return { sent: true, provider: "twilio" };
  }
}
