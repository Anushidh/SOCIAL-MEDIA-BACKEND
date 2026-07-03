import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/entities/user.entity';
import { PasswordReset } from './entities/password-reset.entity';
import { EmailService } from '../email/email.service';
import { RegisterDto, LoginDto, AuthResponseDto, OAuthUserDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { username, email, password, displayName } = registerDto;

    // Check existing user
    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = this.usersRepository.create({
      username,
      email,
      password: hashedPassword,
      displayName: displayName || username,
    });

    await this.usersRepository.save(user);

    return this.buildAuthResponse(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const user = await this.usersRepository.findOne({
      where: { email, isActive: true },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async validateOAuthUser(oauthUserDto: OAuthUserDto): Promise<User> {
    const { email, displayName, avatarUrl, provider, providerId } = oauthUserDto;

    // Try to find existing user by provider ID
    let user = await this.usersRepository.findOne({
      where: { oauthProvider: provider, oauthProviderId: providerId },
    });

    if (user) {
      return user;
    }

    // Try to find by email and link the OAuth account
    if (email) {
      user = await this.usersRepository.findOne({ where: { email } });

      if (user) {
        user.oauthProvider = provider;
        user.oauthProviderId = providerId;
        if (!user.avatarUrl && avatarUrl) {
          user.avatarUrl = avatarUrl;
        }
        return this.usersRepository.save(user);
      }
    }

    // Create new user from OAuth data
    const username = await this.generateUniqueUsername(displayName || 'user');

    user = this.usersRepository.create({
      email,
      username,
      displayName: displayName || username,
      avatarUrl,
      oauthProvider: provider,
      oauthProviderId: providerId,
    });

    return this.usersRepository.save(user);
  }

  buildAuthResponse(user: User): AuthResponseDto {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  private async generateUniqueUsername(baseName: string): Promise<string> {
    const sanitized = baseName
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .substring(0, 20);

    let username = sanitized;
    let suffix = 1;

    while (
      await this.usersRepository.findOne({ where: { username } })
    ) {
      username = `${sanitized}${suffix}`;
      suffix++;
    }

    return username;
  }

  // ─── Password Reset ────────────────────────────────────────────────────────

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { email: forgotPasswordDto.email, isActive: true },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return;
    }

    // Invalidate previous tokens
    await this.passwordResetRepository.update(
      { userId: user.id, isUsed: false },
      { isUsed: true },
    );

    // Create new reset token
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    const reset = this.passwordResetRepository.create({
      userId: user.id,
      token,
      expiresAt,
    });
    await this.passwordResetRepository.save(reset);

    // Send email
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.username,
      token,
    );
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, newPassword } = resetPasswordDto;

    const reset = await this.passwordResetRepository.findOne({
      where: {
        token,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    if (!reset) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    await this.usersRepository.update(reset.userId, {
      password: hashedPassword,
    });

    // Mark token as used
    reset.isUsed = true;
    await this.passwordResetRepository.save(reset);
  }
}
