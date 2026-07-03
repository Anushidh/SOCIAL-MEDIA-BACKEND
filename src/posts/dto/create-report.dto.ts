import { IsEnum, IsString, IsOptional, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportReason } from '../entities/report.entity';

export class CreateReportDto {
  @ApiProperty({ description: 'ID of the entity being reported (post, comment, or user)' })
  @IsUUID()
  entityId: string;

  @ApiProperty({ description: 'Type of entity', enum: ['post', 'comment', 'user'] })
  @IsString()
  entityType: string;

  @ApiProperty({ enum: ReportReason })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiPropertyOptional({ example: 'This post contains inappropriate content' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
