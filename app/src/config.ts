const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  console.warn('EXPO_PUBLIC_API_URL is not set — copy .env.example to .env');
}

export const Config = {
  apiUrl: (apiUrl ?? 'http://10.0.2.2:5000').replace(/\/$/, ''),
} as const;
