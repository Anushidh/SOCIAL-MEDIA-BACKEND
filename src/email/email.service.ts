import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendOtpEmail(
    email: string,
    username: string,
    otp: string,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM', '"ConnectSphere" <noreply@connectsphere.app>'),
        to: email,
        subject: 'Your verification code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome, ${username}!</h2>
            <p>Use the code below to verify your email address. It expires in 10 minutes.</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; text-align: center;
                        padding: 24px; background: #f3f4f6; border-radius: 8px; margin: 24px 0;">
              ${otp}
            </div>
            <p style="color: #666;">If you didn't create an account, you can ignore this email.</p>
          </div>
        `,
      });
      this.logger.log(`OTP email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}`, error);
    }
  }

  async sendVerificationEmail(
    email: string,
    username: string,
    token: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    const verificationUrl = `${appUrl}/auth/verify-email?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM', '"ConnectSphere" <noreply@connectsphere.app>'),
        to: email,
        subject: 'Verify your email address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome, ${username}!</h2>
            <p>Please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}"
               style="display: inline-block; padding: 12px 24px; background-color: #0f766e; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Verify Email
            </a>
            <p>If the button doesn't work, copy and paste this link:</p>
            <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
            <p>This link expires in 24 hours.</p>
          </div>
        `,
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, error);
    }
  }

  async sendPasswordResetEmail(
    email: string,
    username: string,
    token: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM', '"ConnectSphere" <noreply@connectsphere.app>'),
        to: email,
        subject: 'Reset your password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hi ${username}, we received a request to reset your password.</p>
            <a href="${resetUrl}"
               style="display: inline-block; padding: 12px 24px; background-color: #0f766e; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Reset Password
            </a>
            <p>If the button doesn't work, copy and paste this link:</p>
            <p style="color: #666; word-break: break-all;">${resetUrl}</p>
            <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
          </div>
        `,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}`, error);
    }
  }
}
