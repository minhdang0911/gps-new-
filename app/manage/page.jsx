import { redirect } from 'next/navigation';

// Server component — redirect ngay tại server, không cần JS client
export default async function ManageIndexPage({ searchParams }) {
    const params = await searchParams;
    const isEn = params?.lang === 'en';

    redirect(isEn ? '/manage/devices/en' : '/manage/devices');
}

