'use client';

import React from 'react';
import { Card, Typography, Divider } from 'antd';
import styles from '../SupportPage.module.css';
import logo from '../../assets/logo-iky.webp';

const { Title, Paragraph, Text } = Typography;

export default function InstallAcceptanceProcess() {
    return (
        <Card variant={false} className={styles.supportCard}>
            <div className={styles.acceptanceHeader}>
                <img src={logo?.src} alt="iKY-GPS Logo" className={styles.acceptanceLogo} />
                <div>
                    <Title level={3} className={styles.acceptanceTitle}>
                        Quy trình nghiệm thu lắp đặt iKY-GPS
                    </Title>
                    {/* <Text type="secondary">Ngày: 2026-02-03</Text> */}
                </div>
            </div>

            <Divider />

            <Title level={4}>LƯU Ý AN TOÀN</Title>
            <ul className={styles.supportList}>
                <li>Ngắt nguồn chính / rút chìa trước khi thao tác.</li>
                <li>Dùng găng tay cách điện, dụng cụ cách điện; tháo trang sức kim loại.</li>
            </ul>

            <Divider />

            <Title level={4}>Thông tin thiết bị</Title>
            <ul className={styles.supportList}>
                <li>IMEI / Serial: ____________________</li>
                <li>SIM (nếu có) / IMSI: ____________________</li>
                <li>Kỹ thuật viên: ____________________</li>
                <li>Khách hàng (nếu có): ____________________</li>
                <li>Ngày / Giờ lắp: ____________________</li>
                <li>Vị trí lắp (mô tả): ____________________</li>
            </ul>

            <Divider />

            <Title level={4}>A. Kiểm tra vật lý &amp; điện</Title>
            <ul className={styles.checkList}>
                <li>☐ Nguồn xe đã ngắt trước khi thao tác</li>
                <li>☐ Thiết bị cố định chắc, bề mặt trên hướng lên trên</li>
                <li>☐ Không đặt thiết bị dưới tấm kim loại kín / trong hộp kim loại</li>
                <li>☐ Dây nguồn &amp; mass (GND) nối chắc, bọc cách điện</li>
                <li>☐ Các kết nối CAN / shunt / IGN (nếu có) đã nối đúng</li>
                <li>☐ Ảnh vị trí lắp đã chụp và lưu</li>
            </ul>

            <Divider />

            <Title level={4}>B. Cấp nguồn &amp; LED (thiết bị có 2 LED: GSM &amp; GPS)</Title>
            <Paragraph>- Cấp lại nguồn, bật chìa.</Paragraph>
            <Paragraph>
                - Ghi trạng thái LED ban đầu: <b>GSM</b> ______ <b>GPS</b> ______
            </Paragraph>

            <Title level={5}>Ý nghĩa LED (áp dụng cho thiết bị này)</Title>

            <Paragraph>
                <b>LED GSM:</b>
            </Paragraph>
            <ul className={styles.supportList}>
                <li>
                    <b>Tắt (Off):</b> Thiết bị chưa khởi động.
                </li>
                <li>
                    <b>Sáng:</b> đang tìm mạng / chưa đăng ký mạng.
                </li>
                <li>
                    <b>Nhấp nháy:</b> đã đăng ký mạng, đang truyền dữ liệu (kết nối 4G LTE).
                </li>
            </ul>

            <Paragraph>
                <b>LED GPS:</b>
            </Paragraph>
            <ul className={styles.supportList}>
                <li>
                    <b>Tắt (Off):</b> Thiết bị chưa khởi động.
                </li>
                <li>
                    <b>Sáng:</b> tìm vệ tinh.
                </li>
                <li>
                    <b>Nhấp nháy:</b> đã có GPS fix, vị trí có thể gửi lên server.
                </li>
            </ul>

            <ul className={styles.checkList}>
                <li>☐ LED GSM / GPS hoạt động theo mô tả trên</li>
            </ul>

            <Divider />

            <Title level={4}>C. Xác minh trên ev.iky.vn (đăng nhập → tìm thiết bị theo IMEI/Serial)</Title>
            <ul className={styles.checkList}>
                <li>☐ Thiết bị Online trên ev.iky.vn (timestamp mới)</li>
                <li>☐ Vị trí GPS trên bản đồ khớp với thực tế</li>
                <li>☐ Ảnh màn hình ev.iky.vn (trạng thái + timestamp) đã lưu</li>
            </ul>

            <Title level={5}>Quan trọng — cấu hình loại xe</Title>
            <Paragraph>
                Lưu ý: Thiết bị xuất xưởng chưa biết sẽ lắp cho loại xe nào. Nếu loại xe (Vehicle type / Profile) trên
                ev.iky.vn chưa khớp với xe thực tế, cần cấu hình lại trước khi nghiệm thu
            </Paragraph>

            <Divider />

            <Title level={4}>
                D. Thông tin GPS / Pin cần kiểm tra kỹ trên ev.iky.vn (Giá trị mẫu hiện trường để so sánh)
            </Title>

            <div className={styles.acceptanceBlock}>
                <Paragraph>
                    <b>Vận tốc (Speed)</b>
                    <br />
                    - Giá trị mẫu kiểm tra: ~10 km/h
                    <br />☐ Vận tốc hiển thị ≈ 10 km/h (±2 km/h)
                </Paragraph>

                <Paragraph>
                    <b>Odo (Quãng đường tích lũy)</b>
                    <br />
                    - Giá trị mẫu: 2269.8 km
                    <br />☐ Odo trên web tương ứng / tăng khi chạy thử
                </Paragraph>

                <Paragraph>
                    <b>Điện áp (Battery Voltage)</b>
                    <br />
                    - Giá trị mẫu: 65.48 V
                    <br />☐ Điện áp ≈ 65.48 V (±0.5 V)
                </Paragraph>

                <Paragraph>
                    <b>Dòng sạc/xả (Current)</b>
                    <br />
                    - Giá trị mẫu: 5 A
                    <br />☐ Dòng ≈ 5 A (±10% hoặc ±0.5 A)
                </Paragraph>

                <Paragraph>
                    <b>Trạng thái (Status)</b>
                    <br />
                    - Giá trị mẫu: Đang sạc
                    <br />☐ Web hiển thị “Đang sạc” khi cắm sạc
                </Paragraph>

                <Paragraph>
                    <b>Trạng thái sạc (SOC)</b>
                    <br />
                    - Giá trị mẫu: 100%
                    <br />☐ SOC = 100% (hoặc khớp với đồng hồ xe ±2–3%)
                </Paragraph>

                <Paragraph>
                    <b>Sức khỏe pin (SOH)</b>
                    <br />
                    - Giá trị mẫu: 100%
                    <br />☐ SOH = 100% (hoặc khớp dữ liệu bảo dưỡng)
                </Paragraph>

                <Paragraph>
                    <b>Chu kỳ sạc/xả (Cycle count)</b>
                    <br />
                    - Giá trị mẫu: 24
                    <br />☐ Cycle count = 24 (hoặc khớp lịch sử)
                </Paragraph>

                <Paragraph>
                    <b>Nhiệt độ pin (Battery Temperature)</b>
                    <br />
                    - Giá trị mẫu: 23 °C
                    <br />☐ Nhiệt độ ≈ 23 °C (±1–3 °C)
                </Paragraph>
            </div>

            <Divider />

            <Title level={4}>E. Kịch bản kiểm tra ngắn (thực hiện tại hiện trường)</Title>
            <ol className={styles.supportList}>
                <li>
                    Trạng thái ban đầu: bật khóa, chụp ảnh màn hình trang thiết bị trên ev.iky.vn (hiển thị tất cả thông
                    số).
                </li>
                <li>
                    Sạc: cắm sạc → web hiển thị “Đang sạc”, Điện áp tăng, Dòng ≈ 5 A, SOC tiến tới 100% (nếu pin gần
                    đầy).
                </li>
                <li>
                    Chạy thử: chạy ~200–500 m ở tốc độ ~10 km/h → kiểm tra Vận tốc ≈ 10 km/h trên web, Odo tăng tương
                    ứng.
                </li>
                <li>Quan sát SOH, Cycle count, Nhiệt độ: ghi lại nếu có bất thường.</li>
                <li>Lưu ảnh màn hình (có timestamp) và ảnh vị trí lắp.</li>
            </ol>

            <Divider />

            <Title level={4}>F. Xử lý nhanh theo trạng thái LED / lỗi thường gặp</Title>
            <ul className={styles.supportList}>
                <li>
                    <b>GSM tắt:</b> kiểm tra nguồn, cầu chì, SIM, đo điện áp.
                </li>
                <li>
                    <b>GSM sáng (tìm mạng):</b> kiểm tra SIM, vị trí lắp, chờ 1–3 phút.
                </li>
                <li>
                    <b>GSM nhấp nháy nhưng offline trên web:</b> kiểm tra mapping IMEI → thiết bị trên ev.iky.vn, chụp
                    ảnh LED và báo support.
                </li>
                <li>
                    <b>GPS tắt / tìm vệ tinh lâu:</b> đưa xe ra khu vực mở, chờ 2–5 phút, kiểm tra vị trí lắp.
                </li>
                <li>
                    <b>Giá trị điện/SOC sai:</b> kiểm tra dây đo/shunt/CAN mapping, scaling, firmware.
                </li>
            </ul>

            <Divider />

            <Title level={4}>G. Tiêu chí nghiệm thu tổng quát</Title>
            <Paragraph>
                <i>
                    Lưu ý: các giá trị kiểm tra trong checklist là tham khảo; các giá trị thực tế có thể khác nhau tùy
                    vào model xe, cấu hình pin, cảm biến và cách tích hợp. Kỹ thuật viên cần đánh giá tính hợp lý theo
                    thông số kỹ thuật của xe cụ thể và ghi rõ nếu có sai lệch.
                </i>
            </Paragraph>

            <ul className={styles.checkList}>
                <li>☐ Thiết bị Online trên ev.iky.vn với timestamp mới</li>
                <li>☐ LED GSM thể hiện trạng thái mạng; nhấp nháy = truyền dữ liệu qua 4G LTE</li>
                <li>☐ LED GPS nhấp nháy khi có fix ở vùng mở</li>
                <li>☐ Vị trí GPS trên web khớp với thực tế</li>
                <li>☐ Vận tốc ≈ 10 km/h (±2 km/h) — (giá trị có thể tùy theo xe)</li>
                <li>☐ Odo tương ứng và tăng khi chạy — (giá trị có thể tùy theo xe)</li>
                <li>☐ Điện áp ≈ 65.48 V (±0.5 V) — (ngưỡng chấp nhận có thể thay đổi theo hệ thống pin)</li>
                <li>☐ Dòng ≈ 5 A (±10% hoặc ±0.5 A) — (giá trị phụ thuộc vào cấu hình sạc)</li>
                <li>☐ Trạng thái hiển thị “Đang sạc” khi cắm sạc</li>
                <li>☐ SOC = 100% (±2–3%) — (có thể khác theo cách tính của BMS)</li>
                <li>☐ SOH = 100% — (tham khảo theo dữ liệu BMS)</li>
                <li>☐ Cycle count = 24 — (tham khảo)</li>
                <li>☐ Nhiệt độ pin ≈ 23 °C (±1–3 °C</li>
            </ul>

            <Divider />

            <Title level={4}>H. Ghi chú / bất thường (ghi rõ giá trị web và giá trị đo thực tế)</Title>
            <Paragraph>
                <b>Ghi chú:</b> ___________________________________________________________
                <br />
                <b>Ảnh / bằng chứng lưu ở:</b> _____________________________________________
            </Paragraph>

            <Paragraph>
                <b>(Không yêu cầu chữ ký nghiệm thu — tài liệu dùng cho test nội bộ)</b>
            </Paragraph>
        </Card>
    );
}
