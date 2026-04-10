import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Painel de Atendimento',
  description: 'Plataforma de atendimento via WhatsApp'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
