type ConfigModule = typeof import('@/config');

/** Loads a fresh copy of the config module, so it re-reads process.env. */
function loadConfig() {
  let mod: ConfigModule | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual<ConfigModule>('@/config');
  });
  return mod!.Config;
}

describe('Config', () => {
  const original = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = original;
  });

  it('reads the API URL from the environment without a trailing slash', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://dev.example.com/';
    expect(loadConfig().apiUrl).toBe('https://dev.example.com');
  });

  it('fails fast when the API URL is missing', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(loadConfig).toThrow(/EXPO_PUBLIC_API_URL is not set/);
  });
});
