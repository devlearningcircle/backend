import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentProduct, PaymentProductSchema } from './schemas/payment-product.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentProduct.name, schema: PaymentProductSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule { }
