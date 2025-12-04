export const formatDateExcel = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

export const getTodayForFileName = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

export const formatDateFromDevice = (tim) => {
    if (!tim) return null;

    const s = String(tim);
    if (s.length !== 12) return null;

    const yy = s.slice(0, 2);
    const MM = s.slice(2, 4);
    const dd = s.slice(4, 6);
    const hh = s.slice(6, 8);
    const mm = s.slice(8, 10);
    const ss = s.slice(10, 12);

    const yyyy = 2000 + Number(yy);

    const date = new Date(`${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}`);

    if (isNaN(date.getTime())) return null;

    // Trả về string đã format
    return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};
