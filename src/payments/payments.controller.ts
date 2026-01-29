import {
    Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '../common/roles/role.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CreatePaymentProductDto } from './dto/create-payment-product.dto';
import { UpdatePaymentProductDto } from './dto/update-payment-product.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { FilterPaymentsDto } from './dto/filter-payments.dto';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import { Request } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
    constructor(private readonly svc: PaymentsService) { }

    /* ========== Admin: products CRUD & lists ========== */

    @Post('products')
    @Roles(Role.ADMIN)
    createProduct(@Body() dto: CreatePaymentProductDto) {
        return this.svc.createProduct(dto);
    }

    @Get('products')
    @Roles(Role.ADMIN)
    getAllProducts() {
        return this.svc.getAllProducts();
    }

    @Get('products/:id')
    @Roles(Role.ADMIN)
    getProduct(@Param('id', new MongoIdPipe()) id: string) {
        return this.svc.getProduct(id);
    }

    @Put('products/:id')
    @Roles(Role.ADMIN)
    updateProduct(
        @Param('id', new MongoIdPipe()) id: string,
        @Body() dto: UpdatePaymentProductDto,
    ) {
        return this.svc.updateProduct(id, dto);
    }

    @Delete('products/:id')
    @Roles(Role.ADMIN)
    deleteProduct(@Param('id', new MongoIdPipe()) id: string) {
        return this.svc.deleteProduct(id);
    }

    @Get()
    @Roles(Role.ADMIN)
    listPayments(@Query() q: FilterPaymentsDto) {
        return this.svc.listPayments(q);
    }

    /* ========== Student: view products, create order, verify, my payments ========== */

    @Get('products/available')
    @Roles(Role.STUDENT)
    getAvailable(@CurrentUser('id') studentId: string) {
        return this.svc.getAvailableProductsForStudent(studentId);
    }

    @Post('create-order')
    @Roles(Role.STUDENT)
    createOrder(
        @CurrentUser('id') studentId: string,
        @Body() body: CreateOrderDto,
    ) {
        return this.svc.createOrder(studentId, body);
    }

    @Post('verify')
    @Roles(Role.STUDENT)
    verifyPayment(
        @CurrentUser('id') studentId: string,
        @Body() dto: VerifyPaymentDto,
    ) {
        return this.svc.verifyPayment(studentId, dto);
    }

    @Get('me')
    @Roles(Role.STUDENT)
    myPayments(@CurrentUser('id') studentId: string) {
        return this.svc.getMyPayments(studentId);
    }

    /* ========== Razorpay Webhook (optional) ========== */
    // NOTE: Ensure you expose raw body for this route (e.g., using a global body parser with verify)
    @Post('webhook')
    // No role check; secured via signature
    async webhook(@Req() req: Request) {
        const signature = req.headers['x-razorpay-signature'] as string | undefined;
        const rawBody = (req as any).rawBody || JSON.stringify(req.body);
        return this.svc.handleWebhook(signature, rawBody, req.body);
    }
}
