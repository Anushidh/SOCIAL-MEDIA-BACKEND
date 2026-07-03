import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ description: 'Short-lived JWT access token (15 minutes)' })
  accessToken: string;

  @ApiProperty()
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    avatarUrl: string;
  };
}
