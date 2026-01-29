import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Channel } from './schemas/otp-management.schema';

@Injectable()
export class NotificationService {
    private transporter: nodemailer.Transporter | null = null;
    private twilioClient: any | null = null; // runtime require (optional)
    private fromEmail: string | undefined;
    private twilioFrom: string | undefined;
    private isProd: boolean;
    private debug: boolean;

    constructor(private readonly config: ConfigService) {
        this.isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
        this.debug = (process.env.NOTIFY_DEBUG || '').toLowerCase() === 'true';

        // SMTP
        const host = this.config.get<string>('SMTP_HOST');
        const port = Number(this.config.get<string>('SMTP_PORT') || 587);
        const user = this.config.get<string>('SMTP_USER');
        const pass = this.config.get<string>('SMTP_PASS');
        this.fromEmail = this.config.get<string>('SMTP_FROM') || 'no-reply@example.com';

        if (host && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });
            void this.transporter.verify().then(
                () => this.debug && console.log('[Mailer] Transport verified'),
                (err) => console.error('[Mailer] Transport verification failed:', err?.message || err),
            );
        } else if (this.isProd) {
            console.warn('[Mailer] Missing SMTP configuration in production.');
        }

        // Twilio (optional)
        const sid = this.config.get<string>('TWILIO_SID');
        const token = this.config.get<string>('TWILIO_TOKEN');
        this.twilioFrom = this.config.get<string>('TWILIO_FROM');
        if (sid && token) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { Twilio } = require('twilio');
                this.twilioClient = new Twilio(sid, token);
            } catch {
                console.error('[Twilio] SDK not available. Install "twilio" to enable SMS.');
            }
        } else if (this.isProd) {
            console.warn('[Twilio] Missing SID/TOKEN in production.');
        }
    }

    async sendOtp(channel: Channel, to: string, code: string, expiresInMinutes: number) {
        if (channel === 'email') {
            return this.sendOtpEmail(to, code, expiresInMinutes);
        }
        return this.sendOtpSms(to, code, expiresInMinutes);
    }

    // Email
    private async sendOtpEmail(to: string, code: string, expiresInMinutes: number) {
        const subject = 'Your password reset code';
        const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5">
        <h2>Password reset</h2>
        <p>Use the following one-time code to reset your password:</p>
        <p style="font-size:22px;font-weight:bold;letter-spacing:2px">${code}</p>
        <p>This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
        <p>If you did not request this, you can ignore this message.</p>
      </div>
    `;
        const text =
            `Password reset code: ${code}\n` +
            `This code expires in ${expiresInMinutes} minutes.\n` +
            `If you did not request this, you can ignore this message.`;

        if (this.transporter) {
            try {
                await this.transporter.sendMail({ from: this.fromEmail, to, subject, html, text });
                this.debug && console.log(`[Mailer] OTP email sent to=${to}`);
                return { ok: true };
            } catch (err) {
                if (!this.isProd) {
                    console.error('[Mailer] send error:', err);
                    console.log(`DEV OTP EMAIL to=${to} code=${code}`);
                    return { ok: true, dev: true };
                }
                throw new InternalServerErrorException('Failed to send email.');
            }
        }

        if (!this.isProd) {
            console.log(`DEV OTP EMAIL to=${to} code=${code}`);
            return { ok: true, dev: true };
        }
        throw new InternalServerErrorException('Email provider not configured.');
    }

    // SMS
    private async sendOtpSms(to: string, code: string, expiresInMinutes: number) {
        const body = `Your password reset code is ${code}. It expires in ${expiresInMinutes} minutes.`;

        if (this.twilioClient && this.twilioFrom) {
            try {
                await this.twilioClient.messages.create({ body, from: this.twilioFrom, to });
                this.debug && console.log(`[Twilio] OTP SMS sent to=${to}`);
                return { ok: true };
            } catch (err) {
                if (!this.isProd) {
                    console.error('[Twilio] send error:', err);
                    console.log(`DEV OTP SMS to=${to} code=${code}`);
                    return { ok: true, dev: true };
                }
                throw new InternalServerErrorException('Failed to send SMS.');
            }
        }

        if (!this.isProd) {
            console.log(`DEV OTP SMS to=${to} code=${code}`);
            return { ok: true, dev: true };
        }
        throw new InternalServerErrorException('SMS provider not configured.');
    }
}
