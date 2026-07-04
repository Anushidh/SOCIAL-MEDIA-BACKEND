import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/entities/user.entity';
import { PasswordReset } from './entities/password-reset.entity';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import {
  RegisterDto,
  LoginDto,
  AuthResponseDto,
  OAuthUserDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendOtpDto,
  RefreshTokenDto,
} from './dto';
import { JwtPayload } from './strategies/jwt.strategy';

// Redis key prefixes
const OTP_PREFIX = 'otp:';           // otp:<email>         → JSON pending registration
const REFRESH_PREFIX = 'refresh:';   // refresh:<userId>    → refreshToken (rotated)

// TTLs in seconds
const OTP_TTL = 10 * 60;            // 10 minutes
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Registration & OTP ───────────────────────────────────────────────────

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const { username, email, password, displayName } = registerDto;

    // Check existing DB user
    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Username already taken');
    }

    // Hash password before storing in Redis
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate OTP and store pending registration in Redis
    const otp = this.generateOtp();
    const pendingData = JSON.stringify({
      username,
      email,
      hashedPassword,
      displayName: displayName || username,
      otp,
    });

    await this.redisService.set(`${OTP_PREFIX}${email}`, pendingData, OTP_TTL);
    await this.emailService.sendOtpEmail(email, username, otp);

    return { message: 'Registration initiated. Please check your email for the 6-digit verification code.' };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ authResponse: AuthResponseDto; refreshToken: string }> {
    const { email, otp } = verifyEmailDto;

    const raw = await this.redisService.get(`${OTP_PREFIX}${email}`);
    if (!raw) {
      throw new BadRequestException('OTP expired or not found. Please register again.');
    }

    const pending = JSON.parse(raw) as {
      username: string;
      email: string;
      hashedPassword: string;
      displayName: string;
      otp: string;
    };

    if (pending.otp !== otp) {
      throw new BadRequestException('Invalid OTP code');
    }

    // OTP valid — delete from Redis and create the user in DB
    await this.redisService.del(`${OTP_PREFIX}${email}`);

    const user = this.usersRepository.create({
      username: pending.username,
      email: pending.email,
      password: pending.hashedPassword,
      displayName: pending.displayName,
      isEmailVerified: true,
    });

    await this.usersRepository.save(user);

    return this.buildAuthResponse(user);
  }

  async resendOtp(resendOtpDto: ResendOtpDto): Promise<{ message: string }> {
    const { email } = resendOtpDto;

    const raw = await this.redisService.get(`${OTP_PREFIX}${email}`);

    // Always respond the same to avoid email enumeration
    if (!raw) {
      return { message: 'If your email is pending verification, a new code has been sent.' };
    }

    const pending = JSON.parse(raw);
    const newOtp = this.generateOtp();
    pending.otp = newOtp;

    // Reset TTL with fresh OTP
    await this.redisService.set(`${OTP_PREFIX}${email}`, JSON.stringify(pending), OTP_TTL);
    await this.emailService.sendOtpEmail(email, pending.username, newOtp);

    return { message: 'If your email is pending verification, a new code has been sent.' };
  }

  // ─── Login & Token Rotation ────────────────────────────────────────────────

  async login(loginDto: LoginDto): Promise<{ authResponse: AuthResponseDto; refreshToken: string }> {
    const { email, password } = loginDto;

    const user = await this.usersRepository.findOne({
      where: { email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    // Reactivate account if it was deactivated
    if (!user.isActive) {
      user.isActive = true;
      await this.usersRepository.save(user);
    }

    return this.buildAuthResponse(user);
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto): Promise<{ authResponse: AuthResponseDto; refreshToken: string }> {
    const { refreshToken } = refreshTokenDto;

    // Decode without verifying first to get the userId
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check Redis — stored token must match (prevents reuse after rotation)
    const stored = await this.redisService.get(`${REFRESH_PREFIX}${payload.sub}`);
    if (!stored || stored !== refreshToken) {
      throw new UnauthorizedException('Refresh token has been revoked or already used');
    }

    const user = await this.usersRepository.findOne({
      where: { id: payload.sub, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Rotate — delete old, issue new
    await this.redisService.del(`${REFRESH_PREFIX}${payload.sub}`);
    return this.buildAuthResponse(user);
  }

  async logout(userId: string): Promise<void> {
    await this.redisService.del(`${REFRESH_PREFIX}${userId}`);
  }

  // ─── OAuth ────────────────────────────────────────────────────────────────

  async validateOAuthUser(oauthUserDto: OAuthUserDto): Promise<User> {
    const { email, displayName, avatarUrl, provider, providerId } = oauthUserDto;

    let user = await this.usersRepository.findOne({
      where: { oauthProvider: provider, oauthProviderId: providerId },
    });

    if (user) return user;

    if (email) {
      user = await this.usersRepository.findOne({ where: { email } });

      if (user) {
        user.oauthProvider = provider;
        user.oauthProviderId = providerId;
        if (!user.avatarUrl && avatarUrl) user.avatarUrl = avatarUrl;
        return this.usersRepository.save(user);
      }
    }

    // New OAuth user — provider already verified the email
    const username = await this.generateUniqueUsername(displayName || 'user');

    user = this.usersRepository.create({
      email,
      username,
      displayName: displayName || username,
      avatarUrl,
      oauthProvider: provider,
      oauthProviderId: providerId,
      isEmailVerified: true,
    });

    return this.usersRepository.save(user);
  }

  buildAuthResponse(user: User): { authResponse: AuthResponseDto; refreshToken: string } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m')) as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d')) as any,
    });

    // Store refresh token in Redis (overwrites any previous one)
    void this.redisService.set(`${REFRESH_PREFIX}${user.id}`, refreshToken, REFRESH_TTL);

    return {
      authResponse: {
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      },
      refreshToken,
    };
  }

  // ─── Password Reset ────────────────────────────────────────────────────────

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { email: forgotPasswordDto.email, isActive: true },
    });

    if (!user) return; // Silent — prevent email enumeration

    await this.passwordResetRepository.update(
      { userId: user.id, isUsed: false },
      { isUsed: true },
    );

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const reset = this.passwordResetRepository.create({
      userId: user.id,
      token,
      expiresAt,
    });
    await this.passwordResetRepository.save(reset);

    await this.emailService.sendPasswordResetEmail(user.email, user.username, token);
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, newPassword } = resetPasswordDto;

    const reset = await this.passwordResetRepository.findOne({
      where: { token, isUsed: false, expiresAt: MoreThan(new Date()) },
      relations: ['user'],
    });

    if (!reset) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await this.usersRepository.update(reset.userId, { password: hashedPassword });

    // Revoke any active refresh tokens for security
    await this.redisService.del(`${REFRESH_PREFIX}${reset.userId}`);

    reset.isUsed = true;
    await this.passwordResetRepository.save(reset);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async generateUniqueUsername(baseName: string): Promise<string> {
    const sanitized = baseName
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .substring(0, 20);

    let username = sanitized;
    let suffix = 1;

    while (await this.usersRepository.findOne({ where: { username } })) {
      username = `${sanitized}${suffix}`;
      suffix++;
    }

    return username;
  }
}
