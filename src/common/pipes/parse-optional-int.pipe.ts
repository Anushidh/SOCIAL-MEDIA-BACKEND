import { PipeTransform, Injectable } from '@nestjs/common';

@Injectable()
export class ParseOptionalIntPipe implements PipeTransform {
  transform(value: any): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
}
