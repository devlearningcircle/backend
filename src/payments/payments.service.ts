import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
// If your tsconfig doesn't have esModuleInterop, use: import * as Razorpay from 'razorpay';
import Razorpay from 'razorpay';

import { PaymentProduct, PaymentProductDocument } from './schemas/payment-product.schema';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { CreatePaymentProductDto } from './dto/create-payment-product.dto';
import { UpdatePaymentProductDto } from './dto/update-payment-product.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { FilterPaymentsDto } from './dto/filter-payments.dto';

import { Student, StudentDocument } from '../students/schemas/student.schema';

@Injectable()
export class PaymentsService {
    private razor: Razorpay;

    constructor(
        @InjectModel(PaymentProduct.name) private productModel: Model<PaymentProductDocument>,
        @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
        @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    ) {
        const key_id = process.env.RAZORPAY_KEY_ID;
        const key_secret = process.env.RAZORPAY_KEY_SECRET;
        if (!key_id || !key_secret) {
            throw new Error('Missing Razorpay credentials. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
        }
        this.razor = new Razorpay({ key_id, key_secret });
    }

    /* =====================
       Products (Admin)
    ===================== */

    async createProduct(dto: CreatePaymentProductDto) {
        const doc = await this.productModel.create({
            name: dto.name.trim(),
            description: dto.description?.trim(),
            type: dto.type ?? 'other',
            currency: dto.currency ?? 'INR',
            amount: dto.amount,
            academicYearId: dto.academicYearId,
            classId: dto.classId,
            isActive: dto.isActive ?? true,
        });
        return doc.toObject();
    }

    async updateProduct(id: string, dto: UpdatePaymentProductDto) {
        const update: any = { ...dto };
        if (dto.name) update.name = dto.name.trim();
        if (dto.description !== undefined) update.description = dto.description?.trim();
        const updated = await this.productModel.findByIdAndUpdate(id, update, { new: true }).lean();
        if (!updated) throw new NotFoundException('Product not found');
        return updated;
    }

    async deleteProduct(id: string) {
        const res = await this.productModel.findByIdAndDelete(id).lean();
        if (!res) throw new NotFoundException('Product not found');
        return { deleted: true };
    }

    getAllProducts() {
        return this.productModel.find().sort({ createdAt: -1 }).lean();
    }

    getProduct(id: string) {
        return this.productModel.findById(id).lean();
    }

    /* ======================================
       Student-facing: list applicable products
    ====================================== */
    async getAvailableProductsForStudent(studentId: string) {
        const stu = await this.studentModel.findById(studentId, { classId: 1, academicYearId: 1 }).lean();
        if (!stu) throw new UnauthorizedException('Student not found');

        const products = await this.productModel
            .find({ classId: stu.classId, academicYearId: stu.academicYearId, isActive: true })
            .sort({ createdAt: -1 })
            .lean();

        // annotate each with payment status
        const payments = await this.paymentModel
            .find({ studentId, productId: { $in: products.map(p => String(p._id)) } })
            .lean();

        const statusByProduct = new Map<string, PaymentDocument>();
        payments.forEach(p => statusByProduct.set(String(p.productId), p));

        return products.map(p => ({
            ...p,
            myPayment: statusByProduct.get(String(p._id)) || null,
        }));
    }

    /* ===========================
       Student: Create Razorpay order
    =========================== */
    async createOrder(studentId: string, body: CreateOrderDto) {
        const product = await this.productModel.findById(body.productId).lean();
        if (!product || !product.isActive) throw new BadRequestException('Invalid product');

        const student = await this.studentModel.findById(studentId, { classId: 1, academicYearId: 1 }).lean();
        if (!student) throw new UnauthorizedException('Student not found');

        // Ensure the product applies to this student
        if (product.classId !== student.classId || product.academicYearId !== student.academicYearId) {
            throw new BadRequestException('Product not applicable for your class/academic year');
        }

        // If already paid, block duplicate payments
        const alreadyPaid = await this.paymentModel.findOne({
            studentId,
            productId: body.productId,
            status: 'paid',
        }).lean();
        if (alreadyPaid) {
            throw new BadRequestException('Payment already completed for this product.');
        }

        // If there is an open order, reuse it
        const existingOpen = await this.paymentModel.findOne({
            studentId,
            productId: body.productId,
            status: 'created',
        }).lean();

        if (existingOpen?.razorpayOrderId) {
            return {
                orderId: existingOpen.razorpayOrderId,
                amount: product.amount * 100,
                currency: product.currency,
                keyId: process.env.RAZORPAY_KEY_ID,
                paymentId: existingOpen.razorpayPaymentId ?? null,
                localPaymentId: existingOpen._id,
            };
        }

        // Create Razorpay order (amount in paise)
        const order = await this.razor.orders.create({
            amount: product.amount * 100,
            currency: product.currency,
            receipt: `prod_${product._id}_stu_${studentId}_${Date.now()}`,
            notes: {
                productId: String(product._id),
                studentId,
            },
        });

        // Record local payment
        const payment = await this.paymentModel.create({
            studentId,
            productId: String(product._id),
            academicYearId: product.academicYearId,
            classId: product.classId,
            currency: product.currency,
            amount: product.amount,
            status: 'created',
            razorpayOrderId: order.id,
        });

        return {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            paymentId: null,
            localPaymentId: payment._id,
        };
    }

    /* ===========================
       Student: Verify payment after checkout
    =========================== */
    async verifyPayment(studentId: string, dto: VerifyPaymentDto) {
        const rec = await this.paymentModel.findOne({
            studentId,
            razorpayOrderId: dto.razorpay_order_id,
        });

        if (!rec) throw new NotFoundException('Payment order not found');

        // If already paid, return idempotently
        if (rec.status === 'paid') {
            return { status: 'paid', paymentId: rec.razorpayPaymentId, orderId: rec.razorpayOrderId };
        }

        const secret = process.env.RAZORPAY_KEY_SECRET!;
        const sign = crypto
            .createHmac('sha256', secret)
            .update(`${dto.razorpay_order_id}|${dto.razorpay_payment_id}`)
            .digest('hex');

        if (sign !== dto.razorpay_signature) {
            // optional: mark as failed
            await this.paymentModel.updateOne(
                { _id: rec._id },
                { $set: { status: 'failed', razorpayPaymentId: dto.razorpay_payment_id, razorpaySignature: dto.razorpay_signature } },
            );
            throw new BadRequestException('Signature verification failed');
        }

        rec.status = 'paid';
        rec.paidAt = new Date();
        rec.razorpayPaymentId = dto.razorpay_payment_id;
        rec.razorpaySignature = dto.razorpay_signature;
        await rec.save();

        return { status: 'paid', paymentId: rec.razorpayPaymentId, orderId: rec.razorpayOrderId };
        // (Optional) You can also verify via Razorpay fetch payment API if desired.
    }

    /* ===========================
       Student: My payments
    =========================== */
    async getMyPayments(studentId: string) {
        return this.paymentModel.find({ studentId }).sort({ createdAt: -1 }).lean();
    }

    /* ===========================
       Admin: list payments with filters
    =========================== */
    async listPayments(filters: FilterPaymentsDto) {
        const q: any = {};
        if (filters.academicYearId) q.academicYearId = filters.academicYearId;
        if (filters.classId) q.classId = filters.classId;
        if (filters.productId) q.productId = filters.productId;
        if (filters.studentId) q.studentId = filters.studentId;
        if (filters.status) q.status = filters.status;

        return this.paymentModel.find(q).sort({ createdAt: -1 }).lean();
    }

    /* ===========================
       Razorpay Webhook (optional)
    =========================== */
    async handleWebhook(signature: string | undefined, rawBody: Buffer | string, jsonBody: any) {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) throw new Error('Missing RAZORPAY_WEBHOOK_SECRET');

        const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(jsonBody));
        const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
        if (expected !== signature) throw new BadRequestException('Invalid webhook signature');

        const event = jsonBody?.event;
        const entity = jsonBody?.payload?.payment?.entity || jsonBody?.payload?.order?.entity;

        if (event === 'payment.captured' && entity) {
            const orderId = entity.order_id;
            const paymentId = entity.id;
            await this.paymentModel.updateOne(
                { razorpayOrderId: orderId },
                { $set: { status: 'paid', paidAt: new Date(), razorpayPaymentId: paymentId } },
            );
        }

        return { received: true };
    }
}
