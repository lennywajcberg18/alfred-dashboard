import './globals.css';

export var metadata = {
  title: 'Alfred — AI Router Platform',
  description: 'Dashboard de gerenciamento do Alfred',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
