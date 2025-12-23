import React from 'react';
import { ClockCircleOutlined, CustomerServiceOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

export function buildSupportContent(isEn) {
    const kpiTexts = isEn
        ? [
              { icon: <ClockCircleOutlined />, label: 'Avg. first response', value: '< 15 minutes' },
              { icon: <CustomerServiceOutlined />, label: 'Support channels', value: 'Phone • Email • Zalo' },
              { icon: <SafetyCertificateOutlined />, label: 'Service uptime', value: '99%+ monitoring' },
          ]
        : [
              { icon: <ClockCircleOutlined />, label: 'Thời gian phản hồi', value: '< 15 phút (trung bình)' },
              { icon: <CustomerServiceOutlined />, label: 'Kênh hỗ trợ', value: 'Điện thoại • Email • Zalo' },
              { icon: <SafetyCertificateOutlined />, label: 'Giám sát hệ thống', value: 'Hoạt động ổn định 99%+' },
          ];

    const faqItems = isEn
        ? [
              {
                  q: 'How long does it take for support to respond?',
                  a: 'During working hours, most requests are responded to within 15–30 minutes via phone or email.',
              },
              {
                  q: 'Which information should I provide when reporting an issue?',
                  a: 'Please include device IMEI, license plate, time of incident, screenshots (if any) and a brief description of the problem.',
              },
              {
                  q: 'Do you support outside of working hours?',
                  a: 'For urgent issues, please call the hotline directly. We maintain on-call support for critical situations.',
              },
          ]
        : [
              {
                  q: 'Thời gian phản hồi hỗ trợ là bao lâu?',
                  a: 'Trong giờ làm việc, đa số yêu cầu được phản hồi trong vòng 15–30 phút qua điện thoại hoặc email.',
              },
              {
                  q: 'Tôi cần cung cấp thông tin gì khi báo lỗi?',
                  a: 'Vui lòng cung cấp IMEI thiết bị, biển số xe, thời gian xảy ra, hình ảnh/chụp màn hình (nếu có) và mô tả ngắn gọn vấn đề.',
              },
              {
                  q: 'Có hỗ trợ ngoài giờ hành chính không?',
                  a: 'Với các trường hợp khẩn cấp, vui lòng liên hệ trực tiếp hotline. Chúng tôi có cơ chế trực hỗ trợ cho các tình huống quan trọng.',
              },
          ];

    const supportChannels = isEn
        ? [
              {
                  label: 'Technical support',
                  desc: 'Activation issues, device operation, GPS signal, reports not updating…',
                  contact: '0938.859.085',
                  contactLink: 'tel:+84938859085',
              },
              {
                  label: 'Sales & partnership',
                  desc: 'Bulk orders, corporate packages, distributors, partnership proposals…',
                  contact: '0917.787.885',
                  contactLink: 'tel:+84917787885',
              },
              {
                  label: 'Email support',
                  desc: 'Non-urgent requests and documents can be sent via email for tracking.',
                  contact: 'contact@iky.vn',
                  contactLink: 'mailto:contact@iky.vn',
              },
          ]
        : [
              {
                  label: 'Hỗ trợ kỹ thuật',
                  desc: 'Các vấn đề kích hoạt, vận hành thiết bị, tín hiệu GPS, báo cáo không cập nhật…',
                  contact: '0938.859.085',
                  contactLink: 'tel:+84938859085',
              },
              {
                  label: 'Kinh doanh & hợp tác',
                  desc: 'Đơn hàng số lượng lớn, gói doanh nghiệp, đại lý, đề xuất hợp tác…',
                  contact: '0917.787.885',
                  contactLink: 'tel:+84917787885',
              },
              {
                  label: 'Hỗ trợ qua email',
                  desc: 'Các yêu cầu không khẩn gấp, cần gửi tài liệu hoặc mô tả chi tiết, vui lòng gửi qua email.',
                  contact: 'contact@iky.vn',
                  contactLink: 'mailto:contact@iky.vn',
              },
          ];

    return { kpiTexts, faqItems, supportChannels };
}
