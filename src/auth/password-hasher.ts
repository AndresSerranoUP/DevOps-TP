import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

/*
 * Compatibility implementation of GamingTrends.Core.HelperClasses.EncrypterHelper.
 * The source application targets .NET 6, whose seeded Random uses the legacy subtractive generator.
 * Existing database values must remain readable.
 */
export function dotNetAscii(value: string): Buffer {
  return Buffer.from(Array.from({ length: value.length }, (_, index) => {
    const code = value.charCodeAt(index);
    return code <= 0x7f ? code : 0x3f;
  }));
}

export function createDotNetRandom(seed: number): () => number {
  const mbig = 2147483647;
  const array = new Array<number>(56).fill(0);
  let mj = 161803398 - Math.abs(seed === -2147483648 ? 2147483647 : seed);
  array[55] = mj;
  let mk = 1;
  for (let i = 1; i <= 54; i++) {
    const ii = (21 * i) % 55;
    array[ii] = mk;
    mk = mj - mk;
    if (mk < 0) mk += mbig;
    mj = array[ii];
  }
  for (let k = 1; k <= 4; k++) {
    for (let i = 1; i <= 55; i++) {
      const n = (i + 30) >= 56 ? i - 25 : i + 30;
      array[i] -= array[n];
      if (array[i] < 0) array[i] += mbig;
    }
  }
  let inext = 0;
  let inextp = 21;
  return () => {
    inext = (inext + 1) % 56;
    inextp = (inextp + 1) % 56;
    let result = array[inext] - array[inextp];
    if (result === mbig) result--;
    if (result < 0) result += mbig;
    return result;
  };
}

export function createSalt(value: string): string {
  let seed = 0;
  for (const byte of dotNetAscii(value)) {
    seed ^= byte;
  }
  const values: number[] = [];
  const state = createDotNetRandom(seed);
  for (let i = 0; i < 4; i++) {
    values.push(state());
  }
  return values.join('');
}

export function encryptPassword(password: string, key: string): string {
  const input = dotNetAscii(password + createSalt(key));
  return createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class PasswordHasher {
  hash(password: string, key: string): string {
    return encryptPassword(password, key);
  }

  createSalt(key: string): string {
    return createSalt(key);
  }
}
