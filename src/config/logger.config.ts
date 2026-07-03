import * as winston from 'winston';
import { WinstonModuleOptions } from 'nest-winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, context }) => {
  const ctx = context ? `[${context}]` : '';
  if (stack) {
    return `${timestamp} ${level} ${ctx} ${message}\n${stack}`;
  }
  return `${timestamp} ${level} ${ctx} ${message}`;
});

export const loggerConfig: WinstonModuleOptions = {
  transports: [
    // Console transport (colorized for development)
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat,
      ),
    }),

    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat,
      ),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat,
      ),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
};
