import { NotFoundException } from '@nestjs/common';

export function assertFound<T>(value: T, message = 'Resource not found'): asserts value is NonNullable<T> {
    if (value == null) throw new NotFoundException(message);
}
