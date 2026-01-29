import {
    Injectable,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    OtpManagement,
    OtpManagementDocument,
    Channel,
} from './schemas/otp-management.schema';

const OTP_EXPIRY_MS = 10 * 60 * 1000;   // 10 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;       // 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000;   // 30 seconds

@Injectable()
export class OtpService {
    constructor(
        @InjectModel(OtpManagement.name)
        private readonly otpModel: Model<OtpManagementDocument>,
    ) { }

    private now() {
        return Date.now();
    }

    private normalizeValue(channel: Channel, value: string) {
        if (channel === 'email') return (value || '').trim().toLowerCase();
        return (value || '').replace(/[^\d+]/g, ''); // keep digits and leading +
    }

    // For debug logs
    debugNormalizedValue(channel: Channel, value: string) {
        return this.normalizeValue(channel, value);
    }

    private generateCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    getExpiryMinutes() {
        return Math.round(OTP_EXPIRY_MS / 60000);
    }

    /** Create or replace OTP for a (channel, identifier) pair */
    async create(channel: Channel, value: string) {
        const identifier = this.normalizeValue(channel, value);
        const code = this.generateCode();
        const expiresAt = new Date(this.now() + OTP_EXPIRY_MS);

        await this.otpModel.updateOne(
            { channel, identifier },
            {
                $set: {
                    code,
                    expiresAt,
                    attempts: 0,
                    lockedUntil: null,
                    lastSentAt: new Date(),
                },
                $setOnInsert: { channel, identifier },
            },
            { upsert: true },
        );

        return code;
    }

    async canResend(channel: Channel, value: string) {
        const identifier = this.normalizeValue(channel, value);
        const doc = await this.otpModel.findOne({ channel, identifier }).lean();
        if (!doc || !doc.lastSentAt) return true;
        return this.now() - new Date(doc.lastSentAt).getTime() >= RESEND_COOLDOWN_MS;
    }

    async markResent(channel: Channel, value: string) {
        const identifier = this.normalizeValue(channel, value);
        await this.otpModel.updateOne(
            { channel, identifier },
            { $set: { lastSentAt: new Date() } },
        );
    }

    async check(channel: Channel, value: string, otp: string) {
        const identifier = this.normalizeValue(channel, value);
        const doc = await this.otpModel.findOne({ channel, identifier });
        if (!doc) throw new BadRequestException('Invalid or expired OTP. Please try again.');

        const now = this.now();

        if (doc.lockedUntil && now < new Date(doc.lockedUntil).getTime()) {
            throw new ForbiddenException('Too many attempts. Try again later.');
        }

        if (now > new Date(doc.expiresAt).getTime()) {
            await this.otpModel.deleteOne({ _id: doc._id });
            throw new BadRequestException('OTP expired. Please request a new one.');
        }

        if (otp !== doc.code) {
            const attempts = (doc.attempts ?? 0) + 1;
            const update: any = { attempts };
            if (attempts >= MAX_ATTEMPTS) {
                update.lockedUntil = new Date(now + LOCKOUT_MS);
            }
            await this.otpModel.updateOne({ _id: doc._id }, { $set: update });
            throw new BadRequestException('Incorrect OTP.');
        }

        return true;
    }

    async verify(channel: Channel, value: string, otp: string) {
        const identifier = this.normalizeValue(channel, value);
        const doc = await this.otpModel.findOne({ channel, identifier });

        if (!doc) throw new BadRequestException('OTP not found. Please request a new one.');

        const now = this.now();

        if (doc.lockedUntil && now < new Date(doc.lockedUntil).getTime()) {
            throw new ForbiddenException('Too many attempts. Try again later.');
        }

        if (now > new Date(doc.expiresAt).getTime()) {
            await this.otpModel.deleteOne({ _id: doc._id });
            throw new BadRequestException('OTP expired. Please request a new one.');
        }

        if (otp !== doc.code) {
            const attempts = (doc.attempts ?? 0) + 1;
            const update: any = { attempts };
            if (attempts >= MAX_ATTEMPTS) {
                update.lockedUntil = new Date(now + LOCKOUT_MS);
            }
            await this.otpModel.updateOne({ _id: doc._id }, { $set: update });
            throw new BadRequestException('Incorrect OTP.');
        }

        await this.otpModel.deleteOne({ _id: doc._id });
        return true;
    }

    async getAttemptsInfo(channel: Channel, value: string) {
        const identifier = this.normalizeValue(channel, value);
        const doc = await this.otpModel.findOne({ channel, identifier }).lean();
        if (!doc) return { attemptsUsed: 0, lockedUntil: null as number | null };
        return {
            attemptsUsed: doc.attempts ?? 0,
            lockedUntil: doc.lockedUntil ? new Date(doc.lockedUntil).getTime() : null,
        };
    }

    async getResendLeftMs(channel: Channel, value: string) {
        const identifier = this.normalizeValue(channel, value);
        const doc = await this.otpModel.findOne({ channel, identifier }).lean();
        if (!doc || !doc.lastSentAt) return 0;
        const left = RESEND_COOLDOWN_MS - (this.now() - new Date(doc.lastSentAt).getTime());
        return Math.max(0, left);
    }
}
