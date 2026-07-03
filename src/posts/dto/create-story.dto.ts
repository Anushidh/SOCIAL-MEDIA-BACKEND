import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoryDto {
  @ApiProperty({ description: 'Image URL for the story' })
  @IsString()
  imageUrl: string;

  @ApiPropertyOptional({ example: 'Beautiful day!' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}
