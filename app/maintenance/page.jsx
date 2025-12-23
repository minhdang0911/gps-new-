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
} from 'antd';

import styles from './Maintenance.module.css';

import { startMaintenance, confirmMaintenance, getMaintenanceDue, getMaintenanceHistory } from '../lib/api/maintain';
import { getDevices } from '../lib/api/devices';
import { getUserList } from '../lib/api/user';

const { Title, Text } = Typography;
const { TextArea } = Input;

/* =======================
    LOCAL STORAGE (hiển thị lịch “cần xác nhận”)
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

    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const selectedDevice = useMemo(() => devices.find((d) => d._id === selectedDeviceId), [devices, selectedDeviceId]);
    const selectedImei = selectedDevice?.imei || '';

    // viewMode: pending | due | history
    const [viewMode, setViewMode] = useState('history');

    // pending local
    const [pendingLocal, setPendingLocal] = useState([]);

    // due api
    const [dueData, setDueData] = useState(null);
    const dueList = useMemo(() => getArrayFromResponse(dueData), [dueData]);
    const [loadingDue, setLoadingDue] = useState(false);

    // history api
    const [historyData, setHistoryData] = useState(null);
    const historyList = useMemo(() => getArrayFromResponse(historyData), [historyData]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const [loadingStart, setLoadingStart] = useState(false);

    // distributors
    const [loadingDistributors, setLoadingDistributors] = useState(false);
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

            // Nếu không có gì trong localStorage
            if (!userString) return '';

            // Thử parse JSON
            const user = JSON.parse(userString);
            return user || '';
        } catch (error) {
            // Nếu không parse được, có thể nó là string thuần
            console.log('LocalStorage userid is not JSON:', error);
            const userString = localStorage.getItem('userid');
            return userString || '';
        }
    }, []);

    /* =======================
        LOAD DEVICES
    ======================= */
    const loadDevices = async () => {
        try {
            setLoadingDevices(true);
            const res = await getDevices({ page: 1, limit: 200 });
            const list = res?.devices || [];
            setDevices(list);

            if (!selectedDeviceId && list.length) {
                setSelectedDeviceId(list[0]._id);
            }
        } catch (err) {
            console.error(err);
            message.error('Không tải được danh sách thiết bị');
        } finally {
            setLoadingDevices(false);
        }
    };

    /* =======================
        LOAD DISTRIBUTORS
    ======================= */
    const loadDistributors = async () => {
        try {
            setLoadingDistributors(true);
            const res = await getUserList({ position: 'distributor', page: 1, limit: 500 });
            const list = res?.items || [];
            const m = new Map();
            list.forEach((u) => {
                const label = u?.name || u?.username || u?.email || u?._id;
                m.set(u?._id, label);
            });
            setDistributorMap(m);
        } catch (err) {
            console.error(err);
            message.error('Không tải được danh sách đại lý');
        } finally {
            setLoadingDistributors(false);
        }
    };

    /* =======================
        LOAD: pending / due / history
    ======================= */
    const loadPendingFromLocal = (imei) => {
        setPendingLocal(readPending(imei));
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
            setPendingLocal([]);
        }
    };

    const loadDue = async (imei) => {
        if (!imei) return;
        try {
            setLoadingDue(true);
            const res = await getMaintenanceDue({ imei });
            setDueData(res);
        } catch (err) {
            console.error(err);
            message.error('Không tải được danh sách sắp đến hạn');
        } finally {
            setLoadingDue(false);
        }
    };

    const loadHistory = async (imei) => {
        if (!imei) return;
        try {
            setLoadingHistory(true);
            const res = await getMaintenanceHistory({ imei, page: 1, limit: 50 });
            setHistoryData(res);

            const histItems = getArrayFromResponse(res);
            syncPendingWithHistory(imei, histItems);
        } catch (err) {
            console.error(err);
            message.error('Không tải được lịch sử bảo trì');
        } finally {
            setLoadingHistory(false);
        }
    };

    /* =======================
        EFFECTS
    ======================= */
    useEffect(() => {
        loadDevices();
        loadDistributors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedImei) return;

        loadPendingFromLocal(selectedImei);
        loadDue(selectedImei);
        loadHistory(selectedImei);

        const p = readPending(selectedImei);
        setViewMode(p.length > 0 ? 'pending' : 'history');

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedImei]);

    /* =======================
        ACTIONS
    ======================= */
    const handleCreateSchedule = async () => {
        if (!selectedDeviceId) return message.warning('Vui lòng chọn thiết bị');
        if (!selectedImei) return message.error('Thiết bị không có IMEI');

        const existing = readPending(selectedImei);
        if (existing.length > 0) {
            setViewMode('pending');
            message.info('Thiết bị đã có lịch bảo trì đang chờ xác nhận. Vui lòng xác nhận để hoàn tất.');
            return;
        }

        try {
            setLoadingStart(true);
            await startMaintenance({ device_id: selectedDeviceId });

            const r = addPending(selectedImei, selectedDevice);
            if (!r.ok && r.reason === 'exists') {
                message.info('Thiết bị đã có lịch bảo trì đang chờ xác nhận. Vui lòng xác nhận để hoàn tất.');
            } else {
                message.success('Đã tạo lịch bảo trì. Vui lòng xác nhận để hoàn tất.');
            }

            loadPendingFromLocal(selectedImei);
            setViewMode('pending');
        } catch (err) {
            console.error(err);

            const backendMsg = err?.response?.data?.message || '';
            if (backendMsg === 'Maintenance already started') {
                message.info('Thiết bị đã có lịch bảo trì đang chờ xác nhận. Vui lòng xác nhận để hoàn tất.');
                loadPendingFromLocal(selectedImei);
                const p = readPending(selectedImei);
                setViewMode(p.length > 0 ? 'pending' : 'due');
                return;
            }

            message.error('Tạo lịch bảo trì không thành công. Vui lòng thử lại.');
        } finally {
            setLoadingStart(false);
        }
    };

    const openConfirm = (row) => {
        if (!confirmedBy) return message.error('Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.');
        if (!selectedImei) return message.error('Thiết bị không có IMEI');

        setRowToConfirm(row);
        setConfirmOpen(true);

        confirmForm.setFieldsValue({
            maintenanceDate: dayjs(),
            note: '',
        });
    };

    const closeConfirm = () => {
        setConfirmOpen(false);
        setRowToConfirm(null);
        confirmForm.resetFields();
    };

    const handleConfirm = async () => {
        if (!selectedImei) return message.error('Thiết bị không có IMEI');
        if (!confirmedBy) return message.error('Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.');

        try {
            setConfirming(true);

            const values = confirmForm.getFieldsValue();
            const dateValue = values?.maintenanceDate;
            const maintenanceDate = dateValue ? dayjs(dateValue).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
            const note = values?.note?.trim();

            const payload = { imei: selectedImei, confirmedBy, maintenanceDate };
            if (note) payload.note = note;

            await confirmMaintenance(payload);

            message.success('Xác nhận bảo trì thành công.');
            closeConfirm();

            // confirm xong => fetch history, sync pending, rồi ẩn pending nếu đã lên lịch sử
            await loadHistory(selectedImei);
            loadPendingFromLocal(selectedImei);

            const p = readPending(selectedImei);
            setViewMode(p.length > 0 ? 'pending' : 'history');
        } catch (err) {
            console.error(err);

            const backendMsg = err?.response?.data?.message || '';
            if (backendMsg.includes('E11000') && backendMsg.includes('imei')) {
                message.info('Lịch bảo trì của thiết bị này đã được xác nhận trước đó. Vui lòng kiểm tra lại lịch sử.');
                await loadHistory(selectedImei);
                loadPendingFromLocal(selectedImei);
                const p = readPending(selectedImei);
                setViewMode(p.length > 0 ? 'pending' : 'history');
                return;
            }

            message.error('Xác nhận bảo trì không thành công. Vui lòng thử lại.');
        } finally {
            setConfirming(false);
        }
    };

    const reloadCurrentView = async () => {
        if (!selectedImei) return;

        loadPendingFromLocal(selectedImei);
        await loadDue(selectedImei);
        await loadHistory(selectedImei);

        const p = readPending(selectedImei);
        if (p.length > 0) setViewMode('pending');
    };

    /* =======================
        TAB VISIBILITY
        pending tab chỉ hiện khi có dữ liệu
    ======================= */
    const showPendingTab = pendingLocal.length > 0;

    const segmentedOptions = useMemo(() => {
        const ops = [];
        if (showPendingTab) ops.push({ label: `Cần xác nhận (${pendingLocal.length})`, value: 'pending' });
        ops.push({ label: `Lịch sử (${historyList.length})`, value: 'history' });
        ops.push({ label: `Sắp đến hạn (${dueList.length})`, value: 'due' });

        return ops;
    }, [showPendingTab, pendingLocal.length, dueList.length, historyList.length]);

    useEffect(() => {
        if (!showPendingTab && viewMode === 'pending') setViewMode('history');
    }, [showPendingTab, viewMode]);

    /* =======================
        TABLE COLUMNS
    ======================= */
    const getRowId = (row) => row?._id || row?._localId || `${row?.createdAt || ''}-${Math.random()}`;

    const renderDeviceCell = () => (
        <div className={styles.deviceCell}>
            <div className={styles.deviceName}>{selectedDevice?.license_plate || '—'}</div>
            <div className={styles.deviceSub}>IMEI: {selectedImei || '-'}</div>
        </div>
    );

    const renderDistributor = (row) => {
        const distributorId = row?.distributor_id;
        if (loadingDistributors) return '...';
        if (!distributorId) return '-';
        return distributorMap.get(distributorId) || distributorId;
    };

    const pendingColumns = [
        {
            title: 'Thời gian tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
        },
        { title: 'Thiết bị', key: 'device', width: 260, render: () => renderDeviceCell() },
        { title: 'Đại lý', key: 'distributor', width: 220, render: (_, row) => renderDistributor(row) },
        {
            title: 'Hành động',
            key: 'action',
            width: 170,
            render: (_, row) => (
                <Button size="small" type="primary" onClick={() => openConfirm(row)}>
                    Xác nhận bảo trì
                </Button>
            ),
        },
    ];

    const dueColumns = [
        { title: 'Thiết bị', key: 'device', width: 260, render: () => renderDeviceCell() },
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
        {
            title: 'Ghi chú',
            dataIndex: 'note',
            key: 'note',
            ellipsis: true,
            render: (v) => v || '-',
        },
    ];

    const historyColumns = [
        {
            title: 'Thời gian tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
        },
        { title: 'Thiết bị', key: 'device', width: 260, render: () => renderDeviceCell() },
        { title: 'Đại lý', key: 'distributor', width: 220, render: (_, row) => renderDistributor(row) },
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
        {
            title: 'Ghi chú',
            dataIndex: 'note',
            key: 'note',
            ellipsis: true,
            width: 250,
            render: (v) => v || '-',
        },
    ];

    const columns = viewMode === 'pending' ? pendingColumns : viewMode === 'due' ? dueColumns : historyColumns;
    const dataSource = viewMode === 'pending' ? pendingLocal : viewMode === 'due' ? dueList : historyList;

    const isLoading = (viewMode === 'history' && loadingHistory) || (viewMode === 'due' && loadingDue);

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <Title level={3} className={styles.title}>
                    Bảo trì thiết bị
                </Title>
                <Text type="secondary">
                    Tạo lịch bảo trì và xác nhận để hoàn tất. Sau khi xác nhận, thông tin sẽ nằm trong mục “Lịch sử”.
                </Text>
            </div>

            <Row gutter={[16, 16]}>
                <Col xs={24} lg={8}>
                    <Card className={styles.card} title="Chọn thiết bị">
                        <div className={styles.field}>
                            <Text strong>Thiết bị</Text>
                            <Select
                                className={styles.select}
                                loading={loadingDevices}
                                value={selectedDeviceId || undefined}
                                onChange={setSelectedDeviceId}
                                placeholder="Chọn thiết bị"
                                optionFilterProp="label"
                                showSearch
                                options={devices.map((d) => ({
                                    value: d._id,
                                    label: `${d.license_plate || d.imei} (IMEI: ${d.imei})`,
                                }))}
                            />
                        </div>

                        <div className={styles.deviceInfo}>
                            <div>
                                <Text type="secondary">Biển số:</Text>{' '}
                                <Text strong>{selectedDevice?.license_plate || '-'}</Text>
                            </div>
                            <div>
                                <Text type="secondary">IMEI:</Text> <Text strong>{selectedImei || '-'}</Text>
                            </div>
                        </div>

                        <Button
                            type="primary"
                            block
                            size="large"
                            loading={loadingStart}
                            onClick={handleCreateSchedule}
                            disabled={!selectedDeviceId}
                        >
                            Tạo lịch bảo trì
                        </Button>

                        <div className={styles.hint}>
                            <Text type="secondary">
                                Nếu thiết bị đã có lịch đang chờ xác nhận, hệ thống sẽ chuyển bạn đến mục “Cần xác
                                nhận”.
                            </Text>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} lg={16}>
                    <Card
                        className={styles.card}
                        title={
                            <Space className={styles.cardTitleRow}>
                                <span>Danh sách</span>
                                <Segmented value={viewMode} onChange={setViewMode} options={segmentedOptions} />
                            </Space>
                        }
                        extra={
                            <Button onClick={reloadCurrentView} disabled={!selectedImei}>
                                Tải lại
                            </Button>
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
                                pagination={{ pageSize: 10 }}
                                scroll={{ x: 980 }}
                            />
                        )}
                    </Card>
                </Col>
            </Row>

            <Modal
                title="Xác nhận bảo trì"
                open={confirmOpen}
                onCancel={closeConfirm}
                okText="Xác nhận"
                cancelText="Hủy"
                onOk={handleConfirm}
                confirmLoading={confirming}
                destroyOnClose
            >
                <div className={styles.modalInfo}>
                    <Text type="secondary">Thiết bị:</Text>{' '}
                    <Text strong>{selectedDevice?.license_plate || selectedImei || '-'}</Text>
                    <br />
                    <Text type="secondary">IMEI:</Text> <Text strong>{selectedImei || '-'}</Text>
                </div>

                <Form layout="vertical" form={confirmForm}>
                    <Form.Item label="Ngày bảo trì (nếu để trống, hệ thống sẽ lấy ngày hôm nay)" name="maintenanceDate">
                        <DatePicker className={styles.datePicker} format="YYYY-MM-DD" allowClear />
                    </Form.Item>

                    <Form.Item label="Ghi chú (không bắt buộc)" name="note">
                        <TextArea rows={3} placeholder="Nhập ghi chú nếu cần..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
