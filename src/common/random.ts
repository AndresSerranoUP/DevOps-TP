import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export abstract class RandomSource {
  abstract nextBytes(length: number): Buffer;
  abstract nextInt(min: number, max: number): number;
  abstract next(): number;
  abstract nextUuid(): string;
}

@Injectable()
export class SystemRandom extends RandomSource {
  nextBytes(length: number): Buffer {
    return crypto.randomBytes(length);
  }

  nextInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  next(): number {
    return Math.random();
  }

  nextUuid(): string {
    return crypto.randomUUID();
  }
}
