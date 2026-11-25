// app/features/lastCruiseReport/columns/lastCruiseColumnRenderers.jsx
import React from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

export const LAST_CRUISE_COLUMN_HELP = {
    index: { vi: 'Số thứ tự của dòng trong bảng.', en: 'Order number of the row.' },
    dev: { vi: 'Mã thiết bị trên xe.', en: 'Device ID.' },
    license_plate: { vi: 'Biển số xe tương ứng với thiết bị.', en: 'License plate linked to device.' },
    fwr: { vi: 'Phiên bản firmware của thiết bị.', en: 'Firmware version.' },
    tim: { vi: 'Thời gian thiết bị (YYMMDDhhmmss).', en: 'Device time (YYMMDDhhmmss).' },
    lat: { vi: 'Vĩ độ vị trí gần nhất.', en: 'Latest latitude.' },
    lon: { vi: 'Kinh độ vị trí gần nhất.', en: 'Latest longitude.' },
    sat: { vi: 'Địa chỉ vị trí gần nhất.', en: 'Latest address.' },
    gps: { vi: 'Trạng thái GPS.', en: 'GPS status.' },
    sos: { vi: 'Trạng thái SOS.', en: 'SOS status.' },
    acc: { vi: 'Trạng thái khóa/nguồn xe.', en: 'Vehicle lock/ignition status.' },
    vgp: { vi: 'Tốc độ ghi nhận (nếu có).', en: 'Recorded speed (if any).' },
    mil: { vi: 'ODO (mil) - quãng đường tích luỹ.', en: 'ODO (mil) - accumulated distance.' },
    createdAt: { vi: 'Thời điểm dữ liệu được lưu lên hệ thống.', en: 'Saved time in system.' },
    updatedAt: { vi: 'Thời điểm dữ liệu được cập nhật mới nhất.', en: 'Last updated time in system.' },
};

export const formatGpsStatus = (gpsValue, translation) => {
    const isLost = Number(gpsValue) === 1;
    return isLost ? translation.table.gpsLost : translation.table.gpsNormal;
};

export const formatSosStatus = (sosValue, translation) => {
    const isTurnedOn = Number(sosValue) === 1;
    return isTurnedOn ? translation.table.sosOn : translation.table.sosOff;
};

export const formatVehicleLockStatus = (accValue, isEnglish) => {
    const isLocked = Number(accValue) === 1;
    if (isEnglish) return isLocked ? 'Vehicle locked' : 'Vehicle unlocked';
    return isLocked ? 'Khóa xe tắt' : 'Khóa xe mở';
};

export const ColumnHeaderWithTooltip = ({ headerLabel, tooltipContent, isEnglish, isMobileScreen }) => {
    const resolvedTooltipText =
        tooltipContent && typeof tooltipContent === 'object'
            ? isEnglish
                ? tooltipContent.en
                : tooltipContent.vi
            : tooltipContent;

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span>{headerLabel}</span>
            <Tooltip
                title={resolvedTooltipText}
                placement="top"
                trigger={isMobileScreen ? ['click'] : ['hover']}
                classNames={{ root: 'table-col-tooltip' }}
                styles={{ root: { maxWidth: 260 }, container: { maxWidth: 260 } }}
                mouseEnterDelay={0.1}
                mouseLeaveDelay={0.1}
            >
                <span
                    className="table-col-help"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 16,
                        height: 16,
                        cursor: 'help',
                        pointerEvents: 'auto',
                    }}
                >
                    <QuestionCircleOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                </span>
            </Tooltip>
        </span>
    );
};
