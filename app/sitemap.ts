// app/sitemap.ts
export default function sitemap() {
    const baseUrl = 'https://ev.iky.vn';

    return [
        {
            url: `${baseUrl}/`,
            lastModified: new Date(),
            changefreq: 'always',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/cruise`,
            lastModified: new Date(),
            changefreq: 'daily',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/report`,
            lastModified: new Date(),
            changefreq: 'daily',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/report/usage-session`,
            lastModified: new Date(),
            changefreq: 'daily',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/manage/devices`,
            lastModified: new Date(),
            changefreq: 'daily',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/support`,
            lastModified: new Date(),
            changefreq: 'monthly',
            priority: 0.5,
        },

        {
            url: `${baseUrl}/support/en`,
            lastModified: new Date(),
            changefreq: 'monthly',
            priority: 0.5,
        },
    ];
}
