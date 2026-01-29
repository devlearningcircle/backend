import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CustomImageDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsDateString()
  @IsOptional()
  uploadDate?: string;
}
