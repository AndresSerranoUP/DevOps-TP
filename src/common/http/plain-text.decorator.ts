import { Header, applyDecorators } from '@nestjs/common';

export function PlainText() {
  return applyDecorators(Header('Content-Type', 'text/plain; charset=utf-8'));
}

export function HtmlContent() {
  return applyDecorators(Header('Content-Type', 'text/html; charset=utf-8'));
}
