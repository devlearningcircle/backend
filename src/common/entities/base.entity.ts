import { Exclude, Expose, Transform } from 'class-transformer';

/**
 * Base entity class for all MongoDB schemas
 * Excludes MongoDB internal fields (__v) and transforms _id to id
 */
export class BaseEntity {
  @Expose({ name: 'id' })
  @Transform(({ obj }) => obj._id?.toString() || obj.id, { toClassOnly: false })
  _id: string;

  @Exclude()
  __v: number;

  createdAt?: Date;
  updatedAt?: Date;
}
