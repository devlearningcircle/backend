import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentProductDto } from './create-payment-product.dto';

export class UpdatePaymentProductDto extends PartialType(CreatePaymentProductDto) { }
