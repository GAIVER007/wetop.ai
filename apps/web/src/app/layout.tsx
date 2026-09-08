import type { ReactNode } from 'react';

export const metadata = { title: 'PMS Luxx Aparts' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          background: '#f6f7f9',
          color: '#1a1a1a',
        }}
      >
        {children}
      </body>
    </html>
  );
}
