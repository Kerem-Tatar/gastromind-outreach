import './globals.css';

export const metadata = {
  title: 'Gastromind Outreach',
  description: 'Gastromind müşteri bulma paneli',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
