import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CustomDocumentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  publishedBy?: string;

  @IsString()
  @IsNotEmpty()
  documentUrl: string;

  @IsDateString()
  @IsOptional()
  uploadDate?: string;
}
