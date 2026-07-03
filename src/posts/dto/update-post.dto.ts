import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePostDto {
  @ApiPropertyOptional({ example: 'Updated post content' })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  content?: string;
}
