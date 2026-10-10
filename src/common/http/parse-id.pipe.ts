import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseIdPipe implements PipeTransform<string | number, number> {
  transform(value: string | number): number {
    const n = Number(value);
    if (isNaN(n) || !Number.isInteger(n) || n < 0) {
      throw new BadRequestException('Invalid id');
    }
    return n;
  }
}
