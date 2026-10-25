import {
  AuthLimits,
  emptyAuthForm,
  toLoginRequest,
  toRegisterRequest,
  validateLogin,
  validateRegister,
  type AuthForm,
} from '@/features/auth/form';

// The app's tsconfig only includes Jest types, so describe the little of Node this test needs.
declare const __dirname: string;
const { readFileSync } = jest.requireActual<{
  readFileSync(file: string, encoding: 'utf8'): string;
}>('node:fs');
const path = jest.requireActual<{ resolve(...segments: string[]): string }>('node:path');

const valid: AuthForm = {
  email: 'ann@example.com',
  password: 'correct-horse-battery',
  displayName: 'Ann',
};

describe('validateLogin', () => {
  it('accepts a normal email and password', () => {
    expect(validateLogin(valid)).toEqual({});
  });

  it('asks for both fields when empty', () => {
    expect(validateLogin(emptyAuthForm)).toEqual({
      email: 'Enter your email.',
      password: 'Enter your password.',
    });
  });

  it('treats a whitespace-only email as empty', () => {
    expect(validateLogin({ ...valid, email: '   ' }).email).toBe('Enter your email.');
  });

  it.each(['not-an-email', 'ann@', '@example.com', 'a nn@example.com'])(
    'rejects the email %j',
    (email) => {
      expect(validateLogin({ ...valid, email }).email).toBe('Enter a valid email address.');
    },
  );

  it('ignores spaces around the email', () => {
    expect(validateLogin({ ...valid, email: '  ann@example.com  ' })).toEqual({});
  });

  it('does not enforce the minimum length when logging in (older passwords still work)', () => {
    expect(validateLogin({ ...valid, password: 'short' })).toEqual({});
  });

  it('rejects emails and passwords longer than the server accepts', () => {
    const longEmail = `${'a'.repeat(AuthLimits.emailMaxLength)}@example.com`;
    expect(validateLogin({ ...valid, email: longEmail }).email).toBeDefined();
    expect(
      validateLogin({ ...valid, password: 'x'.repeat(AuthLimits.passwordMaxLength + 1) }).password,
    ).toBeDefined();
  });
});

describe('validateRegister', () => {
  it('accepts valid details', () => {
    expect(validateRegister(valid)).toEqual({});
  });

  it('reports every missing field', () => {
    expect(Object.keys(validateRegister(emptyAuthForm)).sort()).toEqual([
      'displayName',
      'email',
      'password',
    ]);
  });

  it('requires the minimum password length, and no more', () => {
    const tooShort = 'x'.repeat(AuthLimits.passwordMinLength - 1);
    const justEnough = 'x'.repeat(AuthLimits.passwordMinLength);
    expect(validateRegister({ ...valid, password: tooShort }).password).toMatch(/at least 8/i);
    expect(validateRegister({ ...valid, password: justEnough }).password).toBeUndefined();
  });

  it('rejects passwords over the maximum length', () => {
    const tooLong = 'x'.repeat(AuthLimits.passwordMaxLength + 1);
    expect(validateRegister({ ...valid, password: tooLong }).password).toMatch(/at most 128/i);
  });

  it('counts spaces as part of the password', () => {
    expect(validateRegister({ ...valid, password: '        ' }).password).toBeUndefined();
  });

  it('rejects a blank or too long name', () => {
    expect(validateRegister({ ...valid, displayName: '   ' }).displayName).toBe('Enter a name.');
    const tooLong = 'n'.repeat(AuthLimits.displayNameMaxLength + 1);
    expect(validateRegister({ ...valid, displayName: tooLong }).displayName).toMatch(/at most 50/i);
    const longest = 'n'.repeat(AuthLimits.displayNameMaxLength);
    expect(validateRegister({ ...valid, displayName: longest }).displayName).toBeUndefined();
  });
});

describe('request builders', () => {
  it('trims the email but sends the password exactly as typed', () => {
    expect(
      toLoginRequest({ ...valid, email: '  ann@example.com ', password: ' pass word ' }),
    ).toEqual({
      email: 'ann@example.com',
      password: ' pass word ',
    });
  });

  it('trims the name when registering', () => {
    expect(toRegisterRequest({ ...valid, displayName: '  Ann  ' })).toEqual({
      email: 'ann@example.com',
      password: 'correct-horse-battery',
      displayName: 'Ann',
    });
  });
});

describe('limits match the server', () => {
  // The limits are enforced by the API too; this fails if one side changes without the other.
  const dtos = readFileSync(
    path.resolve(__dirname, '../../../../../backend/src/LinkUp.Api/Dtos/AuthDtos.cs'),
    'utf8',
  );
  const serverLimit = (name: string) => {
    const match = new RegExp(`const int ${name}\\s*=\\s*(\\d+)`).exec(dtos);
    if (!match) throw new Error(`${name} not found in AuthDtos.cs`);
    return Number(match[1]);
  };

  it.each([
    ['EmailMaxLength', AuthLimits.emailMaxLength],
    ['PasswordMinLength', AuthLimits.passwordMinLength],
    ['PasswordMaxLength', AuthLimits.passwordMaxLength],
    ['DisplayNameMaxLength', AuthLimits.displayNameMaxLength],
  ])('%s', (name, appValue) => {
    expect(appValue).toBe(serverLimit(name));
  });
});
