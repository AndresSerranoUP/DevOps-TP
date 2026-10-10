import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class KeyNormalizePipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body' && metadata.type !== 'query') {
      return value;
    }
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      const normalized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        const camelKey = key.length > 0 ? key.charAt(0).toLowerCase() + key.slice(1) : key;
        normalized[camelKey] = val;
        // Also keep original key if different so legacy lookups continue working if any
        if (camelKey !== key && !(key in normalized)) {
          normalized[key] = val;
        }
      }
      return normalized;
    }
    return value;
  }
}
