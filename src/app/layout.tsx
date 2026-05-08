import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AppSettingsProvider } from '@/lib/app-settings';
import { I18nProvider } from '@/lib/i18n';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin']
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin']
});

export const metadata: Metadata = {
    title: 'GPT Image Playground',
    description: "Generate and edit images using OpenAI's GPT Image models.",
    icons: {
        icon: '/favicon.svg'
    },
    other: {
        google: 'notranslate'
    }
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='zh-CN' translate='no' className='notranslate' suppressHydrationWarning>
            <body translate='no' className={`${geistSans.variable} ${geistMono.variable} notranslate antialiased`}>
                <ThemeProvider attribute='class' defaultTheme='dark' enableSystem disableTransitionOnChange>
                    <I18nProvider>
                        <AppSettingsProvider>{children}</AppSettingsProvider>
                    </I18nProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
