import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
import type { Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('FACEBOOK_APP_ID', ''),
      clientSecret: configService.get<string>('FACEBOOK_APP_SECRET', ''),
      callbackURL: configService.get<string>(
        'FACEBOOK_CALLBACK_URL',
        'http://localhost:3000/api/auth/facebook/callback',
      ),
      scope: ['email'],
      profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any) => void,
  ): Promise<void> {
    const user = await this.authService.validateOAuthUser({
      email: profile.emails?.[0]?.value || '',
      displayName: profile.displayName || '',
      avatarUrl: profile.photos?.[0]?.value,
      provider: 'facebook',
      providerId: profile.id,
    });

    done(null, user);
  }
}
