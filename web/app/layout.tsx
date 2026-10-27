import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { clash, gambetta, mono } from '../src/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Phosphor One',
  description: 'A keyboard that glows when you type.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${clash.variable} ${gambetta.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
