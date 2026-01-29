import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Types } from 'mongoose';

/**
 * Interceptor that transforms MongoDB ObjectIds to strings in responses
 * This ensures all _id fields and reference fields are properly serialized
 */
@Injectable()
export class MongoSerializeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map(data => this.transformResponse(data)));
  }

  private transformResponse(data: any, seen = new WeakSet()): any {
    if (!data) return data;

    // Prevent infinite recursion from circular references
    if (typeof data === 'object' && data !== null) {
      if (seen.has(data)) {
        return '[Circular]';
      }
      seen.add(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.transformResponse(item, seen));
    }

    if (typeof data === 'object') {
      const transformed: any = {};

      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          const value = data[key];

          // Skip internal mongoose properties that can cause circular references
          if (key === '$__' || key === '$isNew' || key === '_doc' || key === 'isNew') {
            continue;
          }

          // Check if it's a MongoDB ObjectId
          if (value instanceof Types.ObjectId) {
            transformed[key] = value.toString();
            // If it's _id, also add it as id
            if (key === '_id') {
              transformed.id = value.toString();
            }
          } else if (value && typeof value === 'object' && value.constructor?.name === 'ObjectID') {
            // Handle ObjectId from different mongoose versions
            transformed[key] = value.toString();
            if (key === '_id') {
              transformed.id = value.toString();
            }
          } else if (Array.isArray(value)) {
            transformed[key] = this.transformResponse(value, seen);
          } else if (value && typeof value === 'object' && !(value instanceof Date)) {
            transformed[key] = this.transformResponse(value, seen);
          } else {
            transformed[key] = value;
          }
        }
      }

      // Ensure _id is always accompanied by id
      if (transformed._id && !transformed.id) {
        transformed.id = transformed._id;
      }

      return transformed;
    }

    return data;
  }
}
