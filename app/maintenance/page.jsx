'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
    Card,
    Row,
    Col,
    Typography,
    Select,
    Button,
    Space,
    Segmented,
    Table,
    Modal,
    Form,
    DatePicker,
    Input,
    message,
    Spin,
    Empty,
    Alert,
    Tag,
} from 'antd';

import styles from './Maintenance.module.css';

import { startMaintenance, confirmMaintenance, getMaintenanceDue, getMaintenanceHistory } from '../lib/api/maintain';
import { getDevices } from '../lib/api/devices';
import { getUserList } from '../lib/api/user';

const { Title, Text } = Typography;
const { TextArea } = Input;

/* =======================
    LOCAL STORAGE (pending “cần xác nhận”)
======================= */
const PENDING_KEY = (imei) => `maint_pending_${imei}`;

function readPending(imei) {
    if (!imei || typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(PENDING_KEY(imei));
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writePending(imei, items) {
    if (!imei || typeof window === 'undefined') return;
    localStorage.setItem(PENDING_KEY(imei), JSON.stringify(items || []));
}

function clearPending(imei) {
    if (!imei || typeof window === 'undefined') return;
    localStorage.removeItem(PENDING_KEY(imei));
}

function addPending(imei, device) {
    const current = readPending(imei);
    if (current.length > 0) return { ok: false, reason: 'exists' };

    const item = {
        _localId: `local_${Date.now()}`,
        imei,
        distributor_id: device?.distributor_id?._id || device?.distributor_id || null,
        createdAt: new Date().toISOString(),
    };

    writePending(imei, [item]);
    return { ok: true, item };
}

function getArrayFromResponse(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.items)) return res.items;
    if (Array.isArray(res.history)) return res.history;
    if (Array.isArray(res.data)) return res.data;
    return [];
}

export default function MaintenancePage() {
    /* =======================
      STATE
  ======================= */
    const [devices, setDevices] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);

    // Filter device (optional) -> lọc bảng + dùng để tạo lịch
    const [filterDeviceId, setFilterDeviceId] = useState('');
    const selectedDevice = useMemo(() => devices.find((d) => d._id === filterDeviceId), [devices, filterDeviceId]);
    const filterImei = selectedDevice?.imei || '';

    // viewMode: pending | due | history
    const [viewMode, setViewMode] = useState('history');

    // pending local overview + filtered
    const [pendingAll, setPendingAll] = useState([]);
    const pendingFiltered = useMemo(() => {
        if (!filterImei) return pendingAll;
        return pendingAll.filter((x) => x?.imei === filterImei);
    }, [pendingAll, filterImei]);

    // due api
    const [dueData, setDueData] = useState(null);
    const dueAll = useMemo(() => getArrayFromResponse(dueData), [dueData]);
    const [loadingDue, setLoadingDue] = useState(false);

    // history api
    const [historyData, setHistoryData] = useState(null);
    const historyAll = useMemo(() => getArrayFromResponse(historyData), [historyData]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Support flag: backend có cho phép gọi ALL hay không
    const [supportsAll, setSupportsAll] = useState(true);

    const [loadingStart, setLoadingStart] = useState(false);

    // ✅ users + distributors maps (chỉ gọi users 1 lần)
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userMap, setUserMap] = useState(() => new Map());
    const [distributorMap, setDistributorMap] = useState(() => new Map());

    // confirm modal
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [confirmForm] = Form.useForm();
    const [rowToConfirm, setRowToConfirm] = useState(null);

    /* =======================
      USER ID (confirmedBy)
  ======================= */
    const confirmedBy = useMemo(() => {
        if (typeof window === 'undefined') return '';

        try {
            const userString = localStorage.getItem('userid');
            if (!userString) return '';
            const user = JSON.parse(userString);
            return user || '';
        } catch (error) {
            console.log('LocalStorage userid is not JSON:', error);
            const userString = localStorage.getItem('userid');
            return userString || '';
        }
    }, []);

    /* =======================
      HELPERS
  ======================= */
    const deviceByImei = useMemo(() => {
        const m = new Map();
        devices.forEach((d) => {
            if (d?.imei) m.set(d.imei, d);
        });
        return m;
    }, [devices]);

    const getDisplayDevice = (row) => {
        const imei = row?.imei || row?.device?.imei || row?.device_id?.imei;
        if (imei && deviceByImei.get(imei)) return deviceByImei.get(imei);
        return row?.device_id || row?.device || null;
    };

    const renderDeviceCellFromRow = (row) => {
        const d = getDisplayDevice(row);
        const imei = row?.imei || d?.imei || '-';
        const plate = row?.license_plate || d?.license_plate || '—';
        return (
            <div className={styles.deviceCell}>
                <div className={styles.deviceName}>{plate}</div>
                <div className={styles.deviceSub}>IMEI: {imei}</div>
            </div>
        );
    };

    const renderDistributor = (row) => {
        const distributorId =
            row?.distributor_id ||
            row?.device_id?.distributor_id?._id ||
            row?.device_id?.distributor_id ||
            row?.device?.distributor_id?._id ||
            row?.device?.distributor_id;

        if (loadingUsers) return '...';
        if (!distributorId) return '-';
        return distributorMap.get(distributorId) || distributorId;
    };

    const renderConfirmedBy = (row) => {
        const id = row?.confirmedBy || row?.confirmed_by;
        if (!id) return '-';
        if (loadingUsers) return '...';
        return userMap.get(id) || id;
    };

    // UX: Tổng quan pending từ localStorage (trên trình duyệt này)
    const loadPendingOverviewFromLocal = (deviceList) => {
        if (typeof window === 'undefined') return;
        const all = [];
        deviceList.forEach((d) => {
            const imei = d?.imei;
            if (!imei) return;
            const p = readPending(imei);
            if (p?.length) all.push(...p);
        });
        setPendingAll(all);
    };

    const historyHasConfirmedAfter = (historyItems, timestampMs) => {
        return historyItems.some((h) => {
            const ht = dayjs(h?.createdAt).valueOf();
            if (Number.isNaN(ht)) return false;
            return !!h?.confirmedBy && ht >= timestampMs;
        });
    };

    const syncPendingWithHistory = (imei, historyItems) => {
        const pending = readPending(imei);
        if (pending.length === 0) return;

        const pendingCreatedAt = dayjs(pending[0]?.createdAt).valueOf();
        if (!Number.isNaN(pendingCreatedAt) && historyHasConfirmedAfter(historyItems, pendingCreatedAt)) {
            clearPending(imei);
        }
    };

    /* =======================
      LOAD DEVICES / USERS (ONE CALL)
  ======================= */
    const loadDevices = async () => {
        try {
            setLoadingDevices(true);
            const res = await getDevices({ page: 1, limit: 200 });
            const list = res?.devices || [];
            setDevices(list);
            loadPendingOverviewFromLocal(list);
        } catch (err) {
            console.error(err);
            message.error('Không tải được danh sách thiết bị');
        } finally {
            setLoadingDevices(false);
        }
    };

    // ✅ Chỉ gọi users 1 lần: build cả userMap + distributorMap
    const loadUsersOnce = async () => {
        try {
            setLoadingUsers(true);

            const res = await getUserList({ page: 1, limit: 2000 });
            const list = res?.items || [];

            const uMap = new Map();
            const dMap = new Map();

            list.forEach((u) => {
                const label = u?.name || u?.username || u?.email || u?._id;
                if (u?._id) uMap.set(u._id, label);

                // distributor map: tùy schema position của bạn
                // nếu u.position === 'distributor' hoặc roles includes distributor
                const isDistributor =
                    u?.position === 'distributor' ||
                    u?.role === 'distributor' ||
                    (Array.isArray(u?.roles) && u.roles.includes('distributor'));

                if (isDistributor && u?._id) dMap.set(u._id, label);
            });

            setUserMap(uMap);
            setDistributorMap(dMap);
        } catch (err) {
            console.error(err);
            message.error('Không tải được danh sách người dùng');
        } finally {
            setLoadingUsers(false);
        }
    };

    /* =======================
      LOAD DUE / HISTORY (ALL hoặc theo filter)
  ======================= */
    const loadDue = async (imei) => {
        try {
            setLoadingDue(true);
            const res = imei ? await getMaintenanceDue({ imei }) : await getMaintenanceDue({});
            setDueData(res);
            setSupportsAll(true);
        } catch (err) {
            console.error(err);
            if (!imei) setSupportsAll(false);
            if (imei) message.error('Không tải được danh sách sắp đến hạn');
        } finally {
            setLoadingDue(false);
        }
    };

    const loadHistory = async (imei) => {
        try {
            setLoadingHistory(true);
            const res = imei
                ? await getMaintenanceHistory({ imei, page: 1, limit: 50 })
                : await getMaintenanceHistory({ page: 1, limit: 50 });

            setHistoryData(res);
            setSupportsAll(true);

            if (imei) {
                const histItems = getArrayFromResponse(res);
                syncPendingWithHistory(imei, histItems);
            }
        } catch (err) {
            console.error(err);
            if (!imei) setSupportsAll(false);
            if (imei) message.error('Không tải được lịch sử bảo trì');
        } finally {
            setLoadingHistory(false);
        }
    };

    /* =======================
      EFFECTS
      ✅ mount: gọi đúng 1 lần
  ======================= */
    useEffect(() => {
        loadDevices();
        loadUsersOnce();

        // Mặc định: load tổng quan ALL (chỉ 1 lần)
        loadDue('');
        loadHistory('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Khi đổi filter thiết bị -> reload theo imei
    useEffect(() => {
        if (!filterImei) return;

        loadDue(filterImei);
        loadHistory(filterImei);

        const p = readPending(filterImei);
        setViewMode(p.length > 0 ? 'pending' : 'history');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterImei]);

    /* =======================
      DATA FILTERING (client-side)
  ======================= */
    const dueList = useMemo(() => {
        if (!filterImei) return dueAll;
        return dueAll.filter((x) => (x?.imei || x?.device_id?.imei || x?.device?.imei) === filterImei);
    }, [dueAll, filterImei]);

    const historyList = useMemo(() => {
        if (!filterImei) return historyAll;
        return historyAll.filter((x) => (x?.imei || x?.device_id?.imei || x?.device?.imei) === filterImei);
    }, [historyAll, filterImei]);

    /* =======================
      ACTIONS
  ======================= */
    const handleCreateSchedule = async () => {
        if (!filterDeviceId) return message.warning('Hãy chọn thiết bị trước khi tạo lịch');
        if (!filterImei) return message.error('Thiết bị không có IMEI');

        const existing = readPending(filterImei);
        if (existing.length > 0) {
            setViewMode('pending');
            message.info('Thiết bị đã có lịch bảo trì đang chờ xác nhận. Vui lòng xác nhận để hoàn tất.');
            return;
        }

        try {
            setLoadingStart(true);
            await startMaintenance({ device_id: filterDeviceId });

            const r = addPending(filterImei, selectedDevice);
            if (!r.ok && r.reason === 'exists') {
                message.info('Thiết bị đã có lịch bảo trì đang chờ xác nhận. Vui lòng xác nhận để hoàn tất.');
            } else {
                message.success('Đã tạo lịch bảo trì. Vui lòng xác nhận để hoàn tất.');
            }

            loadPendingOverviewFromLocal(devices);
            setViewMode('pending');
        } catch (err) {
            console.error(err);

            const backendMsg = err?.response?.data?.message || '';
            if (backendMsg === 'Maintenance already started') {
                message.info('Thiết bị đã có lịch bảo trì đang chờ xác nhận. Vui lòng xác nhận để hoàn tất.');
                loadPendingOverviewFromLocal(devices);
                setViewMode('pending');
                return;
            }

            message.error('Tạo lịch bảo trì không thành công. Vui lòng thử lại.');
        } finally {
            setLoadingStart(false);
        }
    };

    const openConfirm = (row) => {
        if (!confirmedBy) return message.error('Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.');

        const imei = row?.imei || filterImei;
        if (!imei) return message.error('Không xác định được IMEI để xác nhận');

        setRowToConfirm(row);
        setConfirmOpen(true);

        confirmForm.setFieldsValue({
            maintenanceDate: dayjs(),
            note: '',
        });
    };

    const handleConfirm = async () => {
        const imei = rowToConfirm?.imei || filterImei;
        if (!imei) return message.error('Không xác định được IMEI để xác nhận');
        if (!confirmedBy) return message.error('Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.');

        try {
            setConfirming(true);

            const values = confirmForm.getFieldsValue();
            const dateValue = values?.maintenanceDate;
            const maintenanceDate = dateValue ? dayjs(dateValue).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
            const note = values?.note?.trim();

            const payload = { imei, confirmedBy, maintenanceDate };
            if (note) payload.note = note;

            await confirmMaintenance(payload);

            message.success('Xác nhận bảo trì thành công.');
            setConfirmOpen(false);
            setRowToConfirm(null);
            confirmForm.resetFields();

            await loadHistory(imei);
            loadPendingOverviewFromLocal(devices);

            if (filterImei === imei) {
                const p = readPending(imei);
                setViewMode(p.length > 0 ? 'pending' : 'history');
            }
        } catch (err) {
            console.error(err);

            const backendMsg = err?.response?.data?.message || '';
            if (backendMsg.includes('E11000') && backendMsg.includes('imei')) {
                message.info('Lịch bảo trì của thiết bị này đã được xác nhận trước đó. Vui lòng kiểm tra lại lịch sử.');
                await loadHistory(imei);
                loadPendingOverviewFromLocal(devices);
                if (filterImei === imei) {
                    const p = readPending(imei);
                    setViewMode(p.length > 0 ? 'pending' : 'history');
                }
                return;
            }

            message.error('Xác nhận bảo trì không thành công. Vui lòng thử lại.');
        } finally {
            setConfirming(false);
        }
    };

    const reload = async () => {
        loadPendingOverviewFromLocal(devices);

        if (filterImei) {
            await loadDue(filterImei);
            await loadHistory(filterImei);
            const p = readPending(filterImei);
            if (p.length > 0) setViewMode('pending');
        } else {
            await loadDue('');
            await loadHistory('');
        }
    };

    /* =======================
      TABS
  ======================= */
    const showPendingTab = pendingFiltered.length > 0 || pendingAll.length > 0;

    const segmentedOptions = useMemo(() => {
        const ops = [];
        const pendingCount = filterImei ? pendingFiltered.length : pendingAll.length;
        const dueCount = filterImei ? dueList.length : dueAll.length;
        const historyCount = filterImei ? historyList.length : historyAll.length;

        if (showPendingTab) ops.push({ label: `Cần xác nhận (${pendingCount})`, value: 'pending' });
        ops.push({ label: `Lịch sử (${historyCount})`, value: 'history' });
        ops.push({ label: `Sắp đến hạn (${dueCount})`, value: 'due' });
        return ops;
    }, [
        showPendingTab,
        filterImei,
        pendingFiltered.length,
        pendingAll.length,
        dueList.length,
        dueAll.length,
        historyList.length,
        historyAll.length,
    ]);

    useEffect(() => {
        if (!showPendingTab && viewMode === 'pending') setViewMode('history');
    }, [showPendingTab, viewMode]);

    /* =======================
      TABLE
  ======================= */
    const getRowId = (row) => row?._id || row?._localId || `${row?.createdAt || ''}-${Math.random()}`;

    const pendingColumns = [
        {
            title: 'Thời gian tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
        },
        { title: 'Thiết bị', key: 'device', width: 280, render: (_, row) => renderDeviceCellFromRow(row) },
        { title: 'Đại lý', key: 'distributor', width: 220, render: (_, row) => renderDistributor(row) },
        {
            title: 'Hành động',
            key: 'action',
            width: 170,
            render: (_, row) => (
                <Button size="small" type="primary" onClick={() => openConfirm(row)}>
                    Xác nhận
                </Button>
            ),
        },
    ];

    const dueColumns = [
        { title: 'Thiết bị', key: 'device', width: 280, render: (_, row) => renderDeviceCellFromRow(row) },
        { title: 'Đại lý', key: 'distributor', width: 220, render: (_, row) => renderDistributor(row) },
        {
            title: 'Km dự kiến',
            dataIndex: 'maintenanceKm',
            key: 'maintenanceKm',
            width: 120,
            render: (v) => (v === null || v === undefined ? '-' : `${v}`),
        },
        {
            title: 'Ngày dự kiến',
            dataIndex: 'maintenanceDate',
            key: 'maintenanceDate',
            width: 150,
            render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD') : '-'),
        },
        { title: 'Ghi chú', dataIndex: 'note', key: 'note', ellipsis: true, render: (v) => v || '-' },
    ];

    const historyColumns = [
        {
            title: 'Thời gian tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
        },
        { title: 'Thiết bị', key: 'device', width: 280, render: (_, row) => renderDeviceCellFromRow(row) },
        { title: 'Đại lý', key: 'distributor', width: 220, render: (_, row) => renderDistributor(row) },

        // ✅ NEW: Confirmed By
        { title: 'Xác nhận bởi', key: 'confirmedBy', width: 200, render: (_, row) => renderConfirmedBy(row) },

        {
            title: 'Km bảo trì',
            dataIndex: 'maintenanceKm',
            key: 'maintenanceKm',
            width: 120,
            render: (v) => (v === null || v === undefined ? '-' : `${v}`),
        },
        {
            title: 'Ngày bảo trì',
            dataIndex: 'maintenanceDate',
            key: 'maintenanceDate',
            width: 150,
            render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD') : '-'),
        },
        { title: 'Ghi chú', dataIndex: 'note', key: 'note', ellipsis: true, width: 250, render: (v) => v || '-' },
    ];

    const columns = viewMode === 'pending' ? pendingColumns : viewMode === 'due' ? dueColumns : historyColumns;

    const dataSource =
        viewMode === 'pending'
            ? filterImei
                ? pendingFiltered
                : pendingAll
            : viewMode === 'due'
            ? dueList
            : historyList;

    const isLoading = (viewMode === 'history' && loadingHistory) || (viewMode === 'due' && loadingDue);

    const statusTag = useMemo(() => {
        if (filterImei) {
            return pendingFiltered.length > 0 ? (
                <Tag color="orange">Đang xem theo thiết bị (chờ xác nhận)</Tag>
            ) : (
                <Tag color="green">Đang xem theo thiết bị</Tag>
            );
        }
        return <Tag color="blue">Tổng quan (tất cả thiết bị)</Tag>;
    }, [filterImei, pendingFiltered.length]);

    /* =======================
      UI
  ======================= */
    const ALL_VALUE = '__ALL__';
    const selectValue = filterDeviceId ? filterDeviceId : ALL_VALUE;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <Title level={3} className={styles.title}>
                    Bảo trì thiết bị
                </Title>
                <Text type="secondary">
                    Mặc định hiển thị <b>tổng quan</b> (tất cả thiết bị). Bạn có thể lọc theo thiết bị để thao tác tạo
                    lịch/xác nhận.
                </Text>
            </div>

            {/* TOOLBAR */}
            <Card className={styles.card} style={{ marginBottom: 16 }}>
                <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} lg={10}>
                        <Space orientation="vertical" style={{ width: '100%' }} size={6}>
                            <Text strong>Lọc theo thiết bị</Text>

                            <Select
                                className={`${styles.select} ${styles.alwaysClear || ''}`}
                                loading={loadingDevices}
                                value={selectValue}
                                onChange={(v) => setFilterDeviceId(v === ALL_VALUE ? '' : v)}
                                showSearch={{ optionFilterProp: 'label' }}
                                placeholder="Chọn thiết bị / Tất cả thiết bị"
                                options={[
                                    { value: ALL_VALUE, label: 'Tất cả thiết bị (Tổng quan)' },
                                    ...devices.map((d) => ({
                                        value: d._id,
                                        label: `${d.license_plate || d.imei} (IMEI: ${d.imei})`,
                                    })),
                                ]}
                            />

                            <Text type="secondary">
                                Tip: Chọn thiết bị để lọc. Nhấn <b>Xem tất cả</b> để quay về tổng quan.
                            </Text>
                        </Space>
                    </Col>

                    <Col xs={24} lg={14}>
                        <Space wrap style={{ justifyContent: 'flex-end', width: '100%' }}>
                            {statusTag}

                            <Button
                                onClick={() => {
                                    setFilterDeviceId('');
                                    setViewMode('history');
                                    // optional: chủ động reload tổng quan ngay
                                    loadDue('');
                                    loadHistory('');
                                }}
                                disabled={!filterDeviceId}
                            >
                                Xem tất cả
                            </Button>

                            <Button
                                type="primary"
                                size="large"
                                loading={loadingStart}
                                onClick={handleCreateSchedule}
                                disabled={!filterDeviceId}
                            >
                                Tạo lịch cho thiết bị
                            </Button>

                            <Button onClick={reload}>Tải lại</Button>
                        </Space>
                    </Col>
                </Row>

                {!supportsAll && (
                    <Alert
                        style={{ marginTop: 12 }}
                        type="warning"
                        showIcon
                        message="Backend hiện chưa hỗ trợ tải 'tổng quan' khi không truyền IMEI."
                        description="Bạn vẫn có thể lọc theo thiết bị để xem dữ liệu. (Trang vẫn hoạt động bình thường theo từng thiết bị.)"
                    />
                )}
            </Card>

            {/* MAIN TABLE */}
            <Row gutter={[16, 16]}>
                <Col xs={24}>
                    <Card
                        className={styles.card}
                        title={
                            <Space className={styles.cardTitleRow}>
                                <span>Danh sách</span>
                                <Segmented value={viewMode} onChange={setViewMode} options={segmentedOptions} />
                            </Space>
                        }
                    >
                        {isLoading ? (
                            <div className={styles.center}>
                                <Spin />
                            </div>
                        ) : dataSource.length === 0 ? (
                            <Empty
                                description={
                                    viewMode === 'pending'
                                        ? 'Không có lịch nào cần xác nhận'
                                        : viewMode === 'due'
                                        ? 'Không có lịch sắp đến hạn'
                                        : 'Chưa có lịch sử bảo trì'
                                }
                            />
                        ) : (
                            <Table
                                rowKey={getRowId}
                                columns={columns}
                                dataSource={dataSource}
                                pagination={{ pageSize: 10, showSizeChanger: false }}
                                scroll={{ x: 980 }}
                            />
                        )}
                    </Card>
                </Col>
            </Row>

            {/* CONFIRM MODAL */}
            <Modal
                title="Xác nhận bảo trì"
                open={confirmOpen}
                onCancel={() => {
                    setConfirmOpen(false);
                    setRowToConfirm(null);
                    confirmForm.resetFields();
                }}
                okText="Xác nhận"
                cancelText="Hủy"
                onOk={handleConfirm}
                confirmLoading={confirming}
                destroyOnHidden
            >
                <div className={styles.modalInfo}>
                    <Text type="secondary">Thiết bị:</Text>{' '}
                    <Text strong>{selectedDevice?.license_plate || rowToConfirm?.imei || '-'}</Text>
                    <br />
                    <Text type="secondary">IMEI:</Text> <Text strong>{rowToConfirm?.imei || filterImei || '-'}</Text>
                </div>

                <Form layout="vertical" form={confirmForm}>
                    <Form.Item label="Ngày bảo trì (nếu để trống, hệ thống sẽ lấy ngày hôm nay)" name="maintenanceDate">
                        <DatePicker className={styles.datePicker} format="YYYY-MM-DD" allowClear />
                    </Form.Item>

                    <Form.Item label="Ghi chú (không bắt buộc)" name="note">
                        <TextArea rows={3} placeholder="Nhập ghi chú nếu cần..." />
                    </Form.Item>
                </Form>

                {rowToConfirm?._localId ? (
                    <Alert
                        style={{ marginTop: 8 }}
                        type="info"
                        showIcon
                        message="Thông tin"
                        description="Mục “Cần xác nhận” hiện được lưu tạm trên trình duyệt (local). Sau khi xác nhận, dữ liệu sẽ nằm trong “Lịch sử”."
                    />
                ) : null}
            </Modal>
        </div>
    );
}
