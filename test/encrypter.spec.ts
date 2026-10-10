import { createSalt, encryptPassword, PasswordHasher, dotNetAscii, createDotNetRandom } from '../src/auth/password-hasher';

describe('Backend EncrypterHelper compatibility', () => {
  it('reproduces the .NET seeded salt sequence', () => {
    expect(createSalt('gamingtrends_encription_key'))
      .toBe('218308541187548331020548827971677329383');
  });

  it('hashes with ASCII(password + salt) and SHA-256 as the Backend does', () => {
    expect(encryptPassword('password', 'gamingtrends_encription_key'))
      .toBe('6bb644e603cb7d4c3f34dce0080075efab12625fb403654dae665cdcba331805');
  });

  it('is deterministic and does not silently omit the configured key', () => {
    expect(encryptPassword('same', 'key')).toBe(encryptPassword('same', 'key'));
    expect(encryptPassword('same', 'key')).not.toBe(encryptPassword('same', 'other-key'));
  });

  it('PasswordHasher delegates to encryptPassword and createSalt', () => {
    const hasher = new PasswordHasher();
    expect(hasher.hash('password', 'gamingtrends_encription_key'))
      .toBe(encryptPassword('password', 'gamingtrends_encription_key'));
    expect(hasher.createSalt('gamingtrends_encription_key'))
      .toBe(createSalt('gamingtrends_encription_key'));
  });

  it('handles non-ASCII characters in dotNetAscii with fallback question mark (0x3f)', () => {
    const buf = dotNetAscii('Café 🎮');
    expect(buf).toBeInstanceOf(Buffer);
    // 'é' (0xe9 > 0x7f) and emoji (> 0x7f) become 0x3f ('?')
    expect(buf.includes(0x3f)).toBe(true);
  });

  it('handles boundary seed -2147483648 in createDotNetRandom', () => {
    const rng = createDotNetRandom(-2147483648);
    const val = rng();
    expect(typeof val).toBe('number');
  });
});
