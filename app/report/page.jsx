import { redirect } from 'next/navigation';

// Server component — redirect ngay tại server, không cần JS client
export default async function ReportHomePage({ searchParams }) {
    const params = await searchParams;
    const isEn = params?.lang === 'en';

    redirect(isEn ? '/report/usage-session/en' : '/report/usage-session');
}

