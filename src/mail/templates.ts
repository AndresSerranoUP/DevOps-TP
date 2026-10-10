export function verificationEmail(url: string): string {
  return `<p>Please click the following link to verify your email address:</p><p><a href="${url}">${url}</a></p>`;
}

export function passwordResetEmail(url: string): string {
  return `<p>Please click the following link to reset your password:</p><p><a href="${url}">${url}</a></p>`;
}

export function passwordChangedHtml(): string {
  return '<html><body>Password Changed!</body></html>';
}
