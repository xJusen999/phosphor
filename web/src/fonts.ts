import localFont from 'next/font/local';
import { JetBrains_Mono } from 'next/font/google';

export const clash = localFont({
  src: [
    { path: './fonts/clash-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/clash-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/clash-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-clash',
  display: 'swap',
});

export const gambetta = localFont({
  src: [
    { path: './fonts/gambetta-400i.woff2', weight: '400', style: 'italic' },
    { path: './fonts/gambetta-500i.woff2', weight: '500', style: 'italic' },
  ],
  variable: '--font-gambetta',
  display: 'swap',
});

export const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});
