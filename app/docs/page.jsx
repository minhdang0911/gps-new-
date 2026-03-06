'use client';
import React from 'react';

/**
 * PDF-like Docs (A4 multi-page) - 1 file JSX
 * - Có trang bìa, mục lục, chia trang, số trang
 * - Mỗi tính năng: mô tả + bước làm + ảnh minh hoạ + chú thích
 * - Không dùng thư viện ngoài
 *
 * Cách dùng:
 *   export default function Page(){ return <GpsGuidePDF /> }
 *   Ctrl/Cmd+P => Save as PDF
 */

export default function GpsGuidePDF() {
    const meta = {
        org: 'IKY GPS',
        title: 'TÀI LIỆU HƯỚNG DẪN NGHIỆP VỤ WEBSITE GPS',
        version: 'v1.0',
        updatedAt: '14/01/2026',
    };

    // ====== CHỖ BẠN THAY ẢNH: sửa src theo ảnh screenshot của bạn ======
    const IMG = {
        monitor_overview: '/docs-img/monitor-overview.png',
        monitor_popup: '/docs-img/monitor-popup.png',
        monitor_sos: '/docs-img/monitor-sos.png',
        monitor_battery: '/docs-img/monitor-battery.png',

        journey_filter: '/docs-img/journey-filter.png',
        journey_map: '/docs-img/journey-map.png',
        journey_playback: '/docs-img/journey-playback.png',

        report_table: '/docs-img/report-table.png',
        report_card: '/docs-img/report-card.png',
        report_columns: '/docs-img/report-columns.png',
        report_dragcol: '/docs-img/report-dragcol.png',
        report_export: '/docs-img/report-export.png',

        manage_list: '/docs-img/manage-list.png',
        manage_form: '/docs-img/manage-form.png',
        manage_export: '/docs-img/manage-export.png',
        manage_device_actions: '/docs-img/manage-device-actions.png',

        support_page: '/docs-img/support.png',
    };

    // ====== CẤU TRÚC PAGES ======
    const pages = [
        {
            headerRight: 'Trang bìa',
            content: <Cover meta={meta} />,
        },
        {
            headerRight: 'Mục lục',
            content: (
                <div>
                    <H1>MỤC LỤC</H1>
                    <Toc
                        items={[
                            '1. Giới thiệu & phạm vi',
                            '2. Giám sát (Real-time)',
                            '3. Hành trình (Xem lại + Playback)',
                            '4. Báo cáo (Table/Card, cột, xuất báo cáo)',
                            '5. Quản lý (CRUD + xuất; Thiết bị: Kích hoạt/Bảo dưỡng)',
                            '6. Hỗ trợ',
                        ]}
                    />
                    <Callout title="Cách cập nhật tài liệu">
                        <ul style={S.ul}>
                            <li>Mỗi khi UI thay đổi, cập nhật lại ảnh screenshot và mô tả bước.</li>
                            <li>Ảnh nên chụp full màn hình phần liên quan (bộ lọc, bảng, popup…).</li>
                            <li>Mỗi ảnh có “Hình X.Y” + chú thích ngắn đúng trọng tâm.</li>
                        </ul>
                    </Callout>
                </div>
            ),
        },

        // ===== INTRO =====
        {
            headerRight: 'Giới thiệu',
            content: (
                <div>
                    <H1>1. GIỚI THIỆU & PHẠM VI</H1>
                    <Box title="Phạm vi chức năng">
                        <ul style={S.ul}>
                            <li>Giám sát: theo dõi vị trí/trạng thái xe theo thời gian thực, SOS, pin.</li>
                            <li>Hành trình: xem lại lộ trình theo khoảng thời gian, playback.</li>
                            <li>Báo cáo: xem dữ liệu table/card, ẩn/hiện cột, kéo thả cột, xuất báo cáo.</li>
                            <li>Quản lý: thêm/sửa/xoá, xuất báo cáo; thiết bị có Kích hoạt xe & Bảo dưỡng.</li>
                            <li>Hỗ trợ: FAQ, hướng dẫn nhanh, kênh liên hệ.</li>
                        </ul>
                    </Box>

                    <Grid2
                        left={
                            <Box title="Vai trò sử dụng (gợi ý)">
                                <SimpleTable
                                    cols={['Vai trò', 'Quyền chính']}
                                    rows={[
                                        ['Vận hành', 'Xem giám sát/hành trình/báo cáo'],
                                        ['CS', 'Tra cứu dữ liệu + hỗ trợ khách'],
                                        ['Kỹ thuật/Admin', 'CRUD quản lý + thao tác SOS/Kích hoạt/Bảo dưỡng'],
                                    ]}
                                />
                            </Box>
                        }
                        right={
                            <Box title="Thuật ngữ">
                                <SimpleTable
                                    cols={['Thuật ngữ', 'Ý nghĩa']}
                                    rows={[
                                        ['Device', 'Thiết bị gắn xe gửi GPS/Pin/SOS…'],
                                        ['Vehicle', 'Xe/đối tượng được giám sát'],
                                        ['SOC', '% dung lượng pin'],
                                        ['SOH', 'Sức khoẻ pin'],
                                        ['Playback', 'Phát lại hành trình theo thời gian'],
                                    ]}
                                />
                            </Box>
                        }
                    />
                </div>
            ),
        },

        // ===== MONITOR =====
        {
            headerRight: 'Giám sát',
            content: (
                <div>
                    <H1>2. GIÁM SÁT (REAL-TIME)</H1>

                    <Box title="2.1 Mục tiêu">
                        <ul style={S.ul}>
                            <li>Xem trạng thái xe và vị trí xe theo thời gian thực trên bản đồ.</li>
                            <li>Bật/tắt SOS theo phân quyền.</li>
                            <li>Xem tình trạng pin theo thời gian thực (SOC/SOH/Nhiệt độ… nếu có).</li>
                        </ul>
                    </Box>

                    <Feature
                        code="2.2"
                        title="Xem vị trí & trạng thái xe theo thời gian thực"
                        desc="Cho phép người dùng chọn xe trong danh sách để xem vị trí hiện tại, trạng thái chạy/dừng/mất tín hiệu và thông tin chi tiết trên popup."
                        steps={[
                            'Tại menu Giám sát → ở panel danh sách xe, nhập biển số/IMEI để tìm xe.',
                            'Click chọn xe trong danh sách.',
                            'Bản đồ tự động focus vào vị trí xe và hiển thị marker.',
                            'Click marker (hoặc auto popup) để xem thông tin chi tiết.',
                        ]}
                        figures={[
                            {
                                label: 'Hình 2.1',
                                caption: 'Màn hình giám sát tổng quan (danh sách xe + bản đồ).',
                                src: IMG.monitor_overview,
                            },
                            {
                                label: 'Hình 2.2',
                                caption: 'Popup chi tiết xe: trạng thái, địa chỉ, thời gian cập nhật, toạ độ…',
                                src: IMG.monitor_popup,
                            },
                        ]}
                    />

                    <Feature
                        code="2.3"
                        title="Bật/Tắt SOS"
                        desc="Cho phép bật hoặc tắt chế độ SOS (khẩn cấp). Thao tác cần xác nhận và ghi log."
                        steps={[
                            'Mở popup chi tiết xe.',
                            'Chọn tab/khối điều khiển (nếu có) → nhấn nút SOS.',
                            'Xác nhận thao tác (Confirm).',
                            'Kiểm tra trạng thái SOS thay đổi và có thông báo hệ thống.',
                        ]}
                        figures={[
                            {
                                label: 'Hình 2.3',
                                caption: 'Nút thao tác SOS trong popup/khối điều khiển.',
                                src: IMG.monitor_sos,
                            },
                        ]}
                    />

                    <Feature
                        code="2.4"
                        title="Theo dõi tình trạng pin theo thời gian thực"
                        desc="Hiển thị SOC/SOH và các chỉ số liên quan (nhiệt độ max/min…) theo thời điểm cập nhật mới nhất."
                        steps={[
                            'Mở popup chi tiết xe.',
                            'Chuyển sang tab/khối Pin.',
                            'Quan sát SOC/SOH, nhiệt độ… (tuỳ dữ liệu).',
                            'Đối chiếu thời điểm cập nhật để đảm bảo dữ liệu là real-time.',
                        ]}
                        figures={[
                            {
                                label: 'Hình 2.4',
                                caption: 'Tab/khối Pin: SOC, SOH, nhiệt độ… theo thời gian thực.',
                                src: IMG.monitor_battery,
                            },
                        ]}
                    />
                </div>
            ),
        },

        // ===== JOURNEY =====
        {
            headerRight: 'Hành trình',
            content: (
                <div>
                    <H1>3. HÀNH TRÌNH (XEM LẠI + PLAYBACK)</H1>

                    <Box title="3.1 Mục tiêu">
                        <ul style={S.ul}>
                            <li>Xem lại hành trình xe đã đi theo khoảng thời gian.</li>
                            <li>Playback theo timeline: Play/Pause, tua, đổi tốc độ.</li>
                        </ul>
                    </Box>

                    <Feature
                        code="3.2"
                        title="Xem lại hành trình theo khoảng thời gian"
                        desc="Người dùng chọn xe và khoảng thời gian để hệ thống trả về lộ trình, hiển thị polyline và các điểm trên bản đồ."
                        steps={[
                            'Vào menu Hành trình.',
                            'Chọn xe cần xem.',
                            'Chọn Start date / End date.',
                            'Nhấn Tìm kiếm/Xem hành trình.',
                            'Hệ thống hiển thị lộ trình trên bản đồ + danh sách điểm (nếu có).',
                        ]}
                        figures={[
                            {
                                label: 'Hình 3.1',
                                caption: 'Bộ lọc hành trình: xe + khoảng thời gian.',
                                src: IMG.journey_filter,
                            },
                            {
                                label: 'Hình 3.2',
                                caption: 'Kết quả lộ trình trên bản đồ (polyline/điểm).',
                                src: IMG.journey_map,
                            },
                        ]}
                    />

                    <Feature
                        code="3.3"
                        title="Playback hành trình"
                        desc="Phát lại hành trình theo thời gian. Có thể điều chỉnh tốc độ và tua tới mốc bất kỳ."
                        steps={[
                            'Sau khi có dữ liệu hành trình, nhấn nút Playback.',
                            'Nhấn Play để bắt đầu phát.',
                            'Dùng thanh timeline để tua tới thời điểm mong muốn.',
                            'Chọn tốc độ x1/x2/x4… (tuỳ UI).',
                            'Nhấn Pause để dừng.',
                        ]}
                        figures={[
                            {
                                label: 'Hình 3.3',
                                caption: 'Khối điều khiển Playback: Play/Pause, timeline, tốc độ.',
                                src: IMG.journey_playback,
                            },
                        ]}
                    />
                </div>
            ),
        },

        // ===== REPORT =====
        {
            headerRight: 'Báo cáo',
            content: (
                <div>
                    <H1>4. BÁO CÁO</H1>

                    <Box title="4.1 Mục tiêu">
                        <ul style={S.ul}>
                            <li>Xem dữ liệu báo cáo theo bộ lọc.</li>
                            <li>Hiển thị Table/Card.</li>
                            <li>Ẩn/hiện cột, kéo thả vị trí cột.</li>
                            <li>Xuất báo cáo.</li>
                        </ul>
                    </Box>

                    <Feature
                        code="4.2"
                        title="Xem báo cáo dạng Table"
                        desc="Hiển thị dữ liệu dạng bảng, hỗ trợ phân trang/sắp xếp."
                        steps={[
                            'Vào menu Báo cáo.',
                            'Nhập bộ lọc (Session ID/Battery ID/Usage/Device ID/SOH/khoảng thời gian…).',
                            'Nhấn Tìm kiếm.',
                            'Quan sát bảng dữ liệu + phân trang.',
                        ]}
                        figures={[
                            {
                                label: 'Hình 4.1',
                                caption: 'Báo cáo dạng Table (danh sách bản ghi).',
                                src: IMG.report_table,
                            },
                        ]}
                    />

                    <Feature
                        code="4.3"
                        title="Chuyển chế độ hiển thị Table/Card"
                        desc="Card phù hợp xem nhanh theo cụm thông tin; Table phù hợp đối soát và xuất file."
                        steps={[
                            'Tại trang Báo cáo, chọn chế độ hiển thị (Table/Card).',
                            'Kiểm tra dữ liệu giữ nguyên bộ lọc, chỉ thay đổi UI hiển thị.',
                        ]}
                        figures={[
                            { label: 'Hình 4.2', caption: 'Báo cáo dạng Card/Chart (tóm tắt).', src: IMG.report_card },
                        ]}
                    />

                    <Feature
                        code="4.4"
                        title="Ẩn/Hiện cột"
                        desc="Cho phép tuỳ chỉnh cột hiển thị để tập trung đúng dữ liệu cần xem."
                        steps={[
                            'Nhấn nút “Cột” (Columns).',
                            'Tick/Bỏ tick cột muốn hiển thị.',
                            'Đóng popup và kiểm tra bảng đã cập nhật.',
                        ]}
                        figures={[
                            { label: 'Hình 4.3', caption: 'Popup chọn cột: hide/show cột.', src: IMG.report_columns },
                        ]}
                    />

                    <Feature
                        code="4.5"
                        title="Kéo thả thay đổi vị trí cột"
                        desc="Cho phép drag & drop header cột để đổi thứ tự; thứ tự này cũng áp dụng khi xuất file."
                        steps={[
                            'Đưa chuột lên header cột muốn di chuyển.',
                            'Giữ kéo (drag) và thả (drop) sang vị trí mới.',
                            'Kiểm tra thứ tự cột đã thay đổi.',
                        ]}
                        figures={[
                            {
                                label: 'Hình 4.4',
                                caption: 'Drag & drop cột trên header để đổi thứ tự.',
                                src: IMG.report_dragcol,
                            },
                        ]}
                    />

                    <Feature
                        code="4.6"
                        title="Xuất báo cáo"
                        desc="Xuất dữ liệu theo bộ lọc hiện tại và theo cấu hình cột (ẩn/hiện + thứ tự)."
                        steps={[
                            'Thiết lập bộ lọc và cột hiển thị như mong muốn.',
                            'Nhấn “Xuất Excel/CSV” (tuỳ hệ thống).',
                            'Tải file và kiểm tra dữ liệu đúng bộ lọc + đúng thứ tự cột.',
                        ]}
                        figures={[{ label: 'Hình 4.5', caption: 'Nút Xuất báo cáo (Export).', src: IMG.report_export }]}
                    />
                </div>
            ),
        },

        // ===== MANAGE =====
        {
            headerRight: 'Quản lý',
            content: (
                <div>
                    <H1>5. QUẢN LÝ</H1>

                    <Box title="5.1 Mục tiêu">
                        <ul style={S.ul}>
                            <li>CRUD: thêm/sửa/xoá dữ liệu quản trị.</li>
                            <li>Xuất báo cáo riêng theo từng mục quản lý.</li>
                            <li>Quản lý thiết bị có 2 nút đặc thù: Kích hoạt xe & Bảo dưỡng.</li>
                        </ul>
                    </Box>

                    <Feature
                        code="5.2"
                        title="Danh sách & bộ lọc"
                        desc="Trang quản lý hiển thị danh sách đối tượng (xe/thiết bị/pin…), có tìm kiếm và phân trang."
                        steps={[
                            'Vào menu Quản lý → chọn module (ví dụ: Thiết bị).',
                            'Dùng bộ lọc/tìm kiếm để lọc danh sách.',
                            'Quan sát phân trang và thông tin hiển thị.',
                        ]}
                        figures={[
                            { label: 'Hình 5.1', caption: 'Danh sách trang quản lý + bộ lọc.', src: IMG.manage_list },
                        ]}
                    />

                    <Feature
                        code="5.3"
                        title="Thêm mới / Sửa / Xoá"
                        desc="Các thao tác CRUD tiêu chuẩn. Xoá cần xác nhận; Sửa cần prefill dữ liệu."
                        steps={[
                            'Nhấn Thêm mới → nhập form → Lưu.',
                            'Chọn 1 bản ghi → Sửa → cập nhật → Lưu.',
                            'Chọn 1 bản ghi → Xoá → Confirm → kiểm tra danh sách cập nhật.',
                        ]}
                        figures={[
                            { label: 'Hình 5.2', caption: 'Form thêm/sửa trong trang quản lý.', src: IMG.manage_form },
                        ]}
                    />

                    <Feature
                        code="5.4"
                        title="Xuất báo cáo trang quản lý"
                        desc="Xuất dữ liệu đang lọc trong module quản lý."
                        steps={['Thiết lập bộ lọc như mong muốn.', 'Nhấn Xuất báo cáo.', 'Tải file và kiểm tra.']}
                        figures={[
                            { label: 'Hình 5.3', caption: 'Nút Export trong trang quản lý.', src: IMG.manage_export },
                        ]}
                    />

                    <Feature
                        code="5.5"
                        title="Quản lý thiết bị: Kích hoạt xe & Bảo dưỡng"
                        desc="Hai thao tác nghiệp vụ quan trọng. Nên yêu cầu confirm và ghi log người thực hiện."
                        steps={[
                            'Trong module Thiết bị, chọn 1 thiết bị/xe.',
                            'Nhấn “Kích hoạt xe” để đưa vào trạng thái hoạt động.',
                            'Nhấn “Bảo dưỡng” để mở quy trình bảo dưỡng (chọn loại + ghi chú).',
                            'Kiểm tra trạng thái hiển thị sau thao tác.',
                        ]}
                        figures={[
                            {
                                label: 'Hình 5.4',
                                caption: '2 nút đặc thù: Kích hoạt xe / Bảo dưỡng.',
                                src: IMG.manage_device_actions,
                            },
                        ]}
                    />
                </div>
            ),
        },

        // ===== SUPPORT =====
        {
            headerRight: 'Hỗ trợ',
            content: (
                <div>
                    <H1>6. HỖ TRỢ</H1>

                    <Feature
                        code="6.1"
                        title="Trang hỗ trợ / FAQ"
                        desc="Tập trung hướng dẫn nhanh, câu hỏi thường gặp, lỗi thường gặp và kênh liên hệ."
                        steps={[
                            'Vào menu Hỗ trợ.',
                            'Chọn nhóm nội dung (FAQ/Hướng dẫn/Liên hệ).',
                            'Tra cứu theo từ khoá hoặc theo danh mục.',
                        ]}
                        figures={[{ label: 'Hình 6.1', caption: 'Màn hình Hỗ trợ/FAQ.', src: IMG.support_page }]}
                    />

                    <Box title="Kênh liên hệ (mẫu)">
                        <div style={S.contactRow}>
                            <span style={S.tag}>Hotline</span> <span>1900-xxxx</span>
                            <span style={S.dot} />
                            <span style={S.tag}>Zalo</span> <span>@iky_support</span>
                            <span style={S.dot} />
                            <span style={S.tag}>Email</span> <span>support@yourdomain.vn</span>
                        </div>
                    </Box>

                    <Callout title="Kết thúc">
                        <div>— Hết tài liệu —</div>
                    </Callout>
                </div>
            ),
        },
    ];

    return (
        <div style={S.app}>
            <div style={S.toolbar} className="no-print">
                <div style={{ fontWeight: 900 }}>{meta.org} • Docs nghiệp vụ</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={S.badge}>Bản {meta.version}</span>
                    <button style={S.btn} onClick={() => window.print()}>
                        In / Xuất PDF
                    </button>
                </div>
            </div>

            <div style={S.pagesWrap}>
                {pages.map((p, i) => (
                    <A4Page key={i} meta={meta} headerRight={p.headerRight} pageNo={i + 1} total={pages.length}>
                        {p.content}
                    </A4Page>
                ))}
            </div>

            <style>{CSS_PRINT}</style>
        </div>
    );
}

/* ===================== COMPONENTS ===================== */

function A4Page({ children, meta, headerRight, pageNo, total }) {
    return (
        <section style={S.page} className="a4-page">
            <div style={S.pageHeader}>
                <div style={{ fontWeight: 900 }}>{meta.org}</div>
                <div style={S.muted}>{headerRight}</div>
            </div>

            <div style={S.pageBody}>{children}</div>

            <div style={S.pageFooter}>
                <div style={S.muted}>
                    {meta.title} • {meta.version}
                </div>
                <div style={S.muted}>
                    Page {pageNo}/{total}
                </div>
            </div>
        </section>
    );
}

function Cover({ meta }) {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={S.logoBox}>{meta.org}</div>
                    <div>
                        <div style={{ fontWeight: 1000, fontSize: 14 }}>Tài liệu hướng dẫn nghiệp vụ</div>
                        <div style={S.muted}>Website GPS</div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={S.badge}>Bản {meta.version}</div>
                    <div style={{ ...S.muted, marginTop: 6 }}>Cập nhật: {meta.updatedAt}</div>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h1 style={S.coverTitle}>{meta.title}</h1>
                <div style={S.coverSub}>Mô tả nghiệp vụ chi tiết theo từng tính năng + ảnh minh hoạ</div>

                <div style={S.coverBoxes}>
                    <div style={S.coverBox}>
                        <div style={S.coverBoxTitle}>Các trang</div>
                        <ul style={S.ul}>
                            <li>Giám sát</li>
                            <li>Hành trình</li>
                            <li>Báo cáo</li>
                            <li>Quản lý</li>
                            <li>Hỗ trợ</li>
                        </ul>
                    </div>

                    <div style={S.coverBox}>
                        <div style={S.coverBoxTitle}>Quy tắc tài liệu</div>
                        <ul style={S.ul}>
                            <li>Mỗi tính năng có bước 1-2-3 rõ ràng</li>
                            <li>Mỗi ảnh có số hình + chú thích</li>
                            <li>Đủ để người mới đọc là làm được</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div style={S.footerLine}>
                <div>
                    <b>{meta.org}</b> • {meta.version}
                </div>
                <div style={S.muted}>Ctrl/Cmd + P → Save as PDF</div>
            </div>
        </div>
    );
}

function H1({ children }) {
    return <div style={S.h1}>{children}</div>;
}

function Box({ title, children }) {
    return (
        <div style={S.box}>
            <div style={S.boxTitle}>{title}</div>
            <div>{children}</div>
        </div>
    );
}

function Callout({ title, children }) {
    return (
        <div style={S.callout}>
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 13, lineHeight: 1.65 }}>{children}</div>
        </div>
    );
}

function Grid2({ left, right }) {
    return (
        <div style={S.grid2}>
            <div>{left}</div>
            <div>{right}</div>
        </div>
    );
}

function Toc({ items }) {
    return (
        <div style={S.box}>
            <div style={S.boxTitle}>Danh mục</div>
            <ol style={S.ol}>
                {items.map((t) => (
                    <li key={t} style={{ marginBottom: 6 }}>
                        {t}
                    </li>
                ))}
            </ol>
        </div>
    );
}

function Feature({ code, title, desc, steps, figures }) {
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={S.featureHeader}>
                <div style={S.featureCode}>{code}</div>
                <div style={{ flex: 1 }}>
                    <div style={S.featureTitle}>{title}</div>
                    <div style={S.featureDesc}>{desc}</div>
                </div>
            </div>

            <Grid2
                left={
                    <Box title="Các bước thực hiện">
                        <ol style={S.ol}>
                            {steps.map((s, i) => (
                                <li key={i} style={{ marginBottom: 6 }}>
                                    {s}
                                </li>
                            ))}
                        </ol>
                    </Box>
                }
                right={
                    <div>
                        {figures.map((f, i) => (
                            <Figure key={i} label={f.label} caption={f.caption} src={f.src} />
                        ))}
                    </div>
                }
            />
        </div>
    );
}

function Figure({ label, caption, src }) {
    return (
        <div style={S.figure}>
            <div style={S.figureTop}>
                <span style={S.figureLabel}>{label}</span>
                <span style={S.figureCaption}>{caption}</span>
            </div>

            {/* Nếu chưa có ảnh, nó sẽ hiện placeholder */}
            {src ? (
                <img
                    src={src}
                    alt={caption}
                    style={S.figureImg}
                    onError={(e) => {
                        // fallback khi path ảnh sai
                        e.currentTarget.style.display = 'none';
                        const p = e.currentTarget.nextSibling;
                        if (p) p.style.display = 'block';
                    }}
                />
            ) : null}

            <div style={S.figurePlaceholder}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Chưa có ảnh</div>
                <div style={S.muted}>Hãy đặt ảnh vào src trong biến IMG</div>
            </div>
        </div>
    );
}

function SimpleTable({ cols, rows }) {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
                <thead>
                    <tr>
                        {cols.map((c) => (
                            <th key={c} style={S.th}>
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i}>
                            {r.map((cell, j) => (
                                <td key={j} style={S.td}>
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ===================== STYLES ===================== */

const S = {
    app: {
        background: '#f3f4f6',
        minHeight: '100vh',
        padding: 16,
        fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
        color: '#0f172a',
    },
    toolbar: {
        maxWidth: 900,
        margin: '0 auto 12px',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '10px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    btn: {
        border: '1px solid #0ea5e9',
        background: '#0ea5e9',
        color: '#fff',
        padding: '8px 10px',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 1000,
    },
    badge: {
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 999,
        background: '#f1f5f9',
        border: '1px solid #e2e8f0',
        display: 'inline-block',
    },

    pagesWrap: { display: 'grid', gap: 16, justifyContent: 'center' },
    page: {
        width: '210mm',
        minHeight: '297mm',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 8px 30px rgba(15,23,42,0.08)',
        border: '1px solid #e5e7eb',
        padding: '14mm 14mm 12mm 14mm',
        display: 'flex',
        flexDirection: 'column',
    },
    pageHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingBottom: 8,
        borderBottom: '1px solid #e5e7eb',
        marginBottom: 12,
    },
    pageBody: { flex: 1 },
    pageFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        paddingTop: 8,
        borderTop: '1px solid #e5e7eb',
        marginTop: 12,
    },
    muted: { color: '#475569', fontSize: 12, lineHeight: 1.5 },

    logoBox: {
        width: 92,
        height: 44,
        borderRadius: 12,
        background: '#0ea5e9',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 1000,
        letterSpacing: 0.5,
    },

    coverTitle: { margin: '14px 0 0 0', fontSize: 22, fontWeight: 1100, lineHeight: 1.25 },
    coverSub: { marginTop: 10, fontSize: 14, color: '#334155', fontWeight: 800 },
    coverBoxes: { marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    coverBox: { border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fafafa' },
    coverBoxTitle: { fontWeight: 1000, marginBottom: 8 },
    footerLine: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #e5e7eb',
        paddingTop: 10,
    },

    h1: {
        fontSize: 15,
        fontWeight: 1100,
        letterSpacing: 0.2,
        paddingBottom: 8,
        borderBottom: '1px solid #e5e7eb',
        marginBottom: 12,
    },

    box: {
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 12,
        background: '#fff',
        marginBottom: 12,
    },
    boxTitle: { fontWeight: 1100, marginBottom: 8, fontSize: 13 },
    callout: {
        border: '1px dashed #94a3b8',
        borderRadius: 12,
        padding: 12,
        background: '#f8fafc',
        marginBottom: 12,
    },

    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' },
    ul: { margin: 0, paddingLeft: 18, lineHeight: 1.65, fontSize: 13 },
    ol: { margin: 0, paddingLeft: 18, lineHeight: 1.65, fontSize: 13 },

    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: {
        textAlign: 'left',
        padding: '10px',
        background: '#f1f5f9',
        borderBottom: '1px solid #e5e7eb',
        fontWeight: 1100,
    },
    td: { padding: '10px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' },

    featureHeader: {
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 12,
        background: '#fff',
        marginBottom: 12,
    },
    featureCode: {
        minWidth: 52,
        textAlign: 'center',
        fontWeight: 1100,
        borderRadius: 10,
        padding: '6px 8px',
        background: '#f1f5f9',
        border: '1px solid #e2e8f0',
        fontSize: 12,
    },
    featureTitle: { fontWeight: 1100, fontSize: 14, marginBottom: 6 },
    featureDesc: { color: '#334155', fontSize: 13, lineHeight: 1.6 },

    figure: { border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
    figureTop: {
        padding: '10px 12px',
        background: '#f1f5f9',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        gap: 8,
        alignItems: 'baseline',
    },
    figureLabel: { fontWeight: 1100, fontSize: 12 },
    figureCaption: { color: '#334155', fontSize: 12, lineHeight: 1.4 },
    figureImg: { width: '100%', display: 'block' },
    figurePlaceholder: {
        display: 'none',
        padding: 12,
        background: 'repeating-linear-gradient(45deg, #ffffff, #ffffff 10px, #f8fafc 10px, #f8fafc 20px)',
    },

    contactRow: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 13 },
    tag: {
        padding: '2px 8px',
        borderRadius: 999,
        border: '1px solid #e5e7eb',
        background: '#f8fafc',
        fontWeight: 1000,
        fontSize: 12,
    },
    dot: { width: 4, height: 4, borderRadius: 999, background: '#94a3b8', display: 'inline-block' },
};

const CSS_PRINT = `
@page { size: A4; margin: 10mm; }
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .a4-page { box-shadow: none !important; border: none !important; border-radius: 0 !important; }
  .a4-page { page-break-after: always; break-after: page; }
}
`;
