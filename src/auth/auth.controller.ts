import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  AuthResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendOtpDto,
} from './dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { FacebookAuthGuard } from './guards/facebook-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private setRefreshCookie(res: Response, refreshToken: string): void {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';
    const cookieSameSite = this.configService.get<string>('COOKIE_SAME_SITE', isProduction ? 'strict' : 'lax');
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: cookieSameSite as 'strict' | 'lax' | 'none',
      maxAge,
      path: '/api/auth',
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  // ─── Registration & OTP ───────────────────────────────────────────────────

  @Post('register')
  @ApiOperation({ summary: 'Register a new user — sends OTP to email' })
  @ApiResponse({ status: 201, description: 'OTP sent to email for verification' })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  async register(@Body() registerDto: RegisterDto): Promise<{ message: string }> {
    return this.authService.register(registerDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with OTP — sets refresh cookie and returns access token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { authResponse, refreshToken } = await this.authService.verifyEmail(verifyEmailDto);
    this.setRefreshCookie(res, refreshToken);
    return authResponse;
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend OTP verification code' })
  @ApiResponse({ status: 200, description: 'New OTP sent if registration is pending' })
  async resendOtp(@Body() resendOtpDto: ResendOtpDto): Promise<{ message: string }> {
    return this.authService.resendOtp(resendOtpDto);
  }

  // ─── Login & Tokens ───────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login — sets refresh cookie and returns access token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials or email not verified' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { authResponse, refreshToken } = await this.authService.login(loginDto);
    this.setRefreshCookie(res, refreshToken);
    return authResponse;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token — reads cookie, sets new cookie, returns new access token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const { authResponse, refreshToken } = await this.authService.refreshTokens({ refreshToken: token });
    this.setRefreshCookie(res, refreshToken);
    return authResponse;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — revokes refresh token and clears cookie' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.id);
    this.clearRefreshCookie(res);
    return { message: 'Logged out successfully' };
  }

  // ─── Password Reset ───────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'If email exists, reset link sent' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(forgotPasswordDto);
    return { message: 'If an account exists with this email, a password reset link has been sent' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(resetPasswordDto);
    return { message: 'Password has been reset successfully' };
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleLogin() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiExcludeEndpoint()
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;
    const { authResponse, refreshToken } = this.authService.buildAuthResponse(user);
    this.setRefreshCookie(res, refreshToken);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    res.redirect(`${frontendUrl}/auth/oauth-callback?token=${authResponse.accessToken}`);
  }

  // ─── Facebook OAuth ───────────────────────────────────────────────────────

  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  @ApiOperation({ summary: 'Initiate Facebook OAuth login' })
  facebookLogin() {
    // Guard redirects to Facebook
  }

  @Get('facebook/callback')
  @UseGuards(FacebookAuthGuard)
  @ApiExcludeEndpoint()
  async facebookCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;
    const { authResponse, refreshToken } = this.authService.buildAuthResponse(user);
    this.setRefreshCookie(res, refreshToken);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    res.redirect(`${frontendUrl}/auth/oauth-callback?token=${authResponse.accessToken}`);
  }
}
