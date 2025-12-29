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
    Table,
    Tag,
    message,
    Spin,
    Empty,
    Modal,
    Form,
    DatePicker,
    Input,
} from 'antd';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';

import { getDevices } from '../lib/api/devices';
import { startMaintenance, confirmMaintenance } from '../lib/api/maintain';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STARTED_KEY = 'maint_started_map_v1';

/** ====== started map (tạm thời random + localStorage) ====== */
function readStartedMap() {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(STARTED_KEY);
        const parsed = JSON.parse(raw || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}
function writeStartedMap(mapObj) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STARTED_KEY, JSON.stringify(mapObj || {}));
}
function ensureRandomStarted(devices) {
    const current = readStartedMap();
    let changed = false;

    devices.forEach((d) => {
        const id = d?._id;
        if (!id) return;
        if (current[id] === undefined) {
            current[id] = Math.random() < 0.3; // random 30%
            changed = true;
        }
    });

    if (changed) writeStartedMap(current);
    return current;
}

/** ====== confirmedBy giống code cũ ====== */
function getConfirmedByFromLocalStorage() {
    if (typeof window === 'undefined') return '';
    const raw = localStorage.getItem('userid');
    if (!raw) return '';

    const s = raw.trim();
    if (s.startsWith('{') || s.startsWith('[') || s.startsWith('"')) {
        try {
            const parsed = JSON.parse(s);
            if (parsed && typeof parsed === 'object' && parsed._id) return String(parsed._id);
            if (typeof parsed === 'string') return parsed;
            return '';
        } catch {
            return s;
        }
    }
    return s;
}

export default function MaintenanceActivatePage() {
    const [devices, setDevices] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);

    const [startedMap, setStartedMap] = useState({});
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const selectedDevice = useMemo(() => devices.find((d) => d._id === selectedDeviceId), [devices, selectedDeviceId]);

    const [starting, setStarting] = useState(false);

    // ====== Search (2 ô: biển số + IMEI) ======
    const [searchPlate, setSearchPlate] = useState('');
    const [searchImei, setSearchImei] = useState('');

    // ====== Confirm modal state (giống code cũ) ======
    const confirmedBy = useMemo(() => getConfirmedByFromLocalStorage(), []);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [confirmForm] = Form.useForm();
    const [rowToConfirm, setRowToConfirm] = useState(null);

    const loadDevices = async ({ license_plate = '', imei = '' } = {}) => {
        try {
            setLoadingDevices(true);

            const res = await getDevices({
                page: 1,
                limit: 200000,
                ...(license_plate ? { license_plate } : {}),
                ...(imei ? { imei } : {}),
            });

            const list = res?.devices || [];
            setDevices(list);

            const map = ensureRandomStarted(list);
            setStartedMap(map);
        } catch (e) {
            console.error(e);
            message.error('Không tải được danh sách thiết bị');
        } finally {
            setLoadingDevices(false);
        }
    };

    useEffect(() => {
        loadDevices({ license_plate: '', imei: '' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** thiết bị chưa start -> mới được chọn trong Select */
    const selectableDevices = useMemo(() => {
        return devices.filter((d) => d?._id && !startedMap[d._id]);
    }, [devices, startedMap]);

    /** Start (chỉ 1 nút Kích hoạt) */
    const handleStart = async () => {
        if (!selectedDeviceId) return message.warning('Hãy chọn thiết bị trước khi kích hoạt');
        const d = selectedDevice;
        if (!d?._id) return message.error('Thiết bị không hợp lệ');

        try {
            setStarting(true);
            await startMaintenance({ device_id: d._id });

            const next = { ...startedMap, [d._id]: true };
            setStartedMap(next);
            writeStartedMap(next);

            message.success('Kích hoạt bảo dưỡng thành công');
            setSelectedDeviceId('');
        } catch (e) {
            console.error(e);
            const backendMsg = e?.response?.data?.message || '';
            if (backendMsg === 'Maintenance already started') {
                const next = { ...startedMap, [selectedDeviceId]: true };
                setStartedMap(next);
                writeStartedMap(next);
                setSelectedDeviceId('');
                message.info('Thiết bị đã được kích hoạt trước đó');
                return;
            }
            message.error('Kích hoạt không thành công. Vui lòng thử lại.');
        } finally {
            setStarting(false);
        }
    };

    /** ====== Confirm logic: y chang code cũ ====== */
    const openConfirm = (row) => {
        if (!confirmedBy) return message.error('Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.');

        const imei = row?.imei;
        if (!imei) return message.error('Không xác định được IMEI để xác nhận');

        setRowToConfirm(row);
        setConfirmOpen(true);

        confirmForm.setFieldsValue({
            maintenanceDate: dayjs(),
            note: '',
        });
    };

    const handleConfirm = async () => {
        const imei = rowToConfirm?.imei;
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

            message.success('Xác nhận bảo dưỡng thành công.');
            setConfirmOpen(false);
            setRowToConfirm(null);
            confirmForm.resetFields();

            // ✅ nếu bạn muốn: confirm xong coi như “đã kích hoạt” để đổi tag + remove khỏi dropdown
            if (rowToConfirm?._id) {
                const next = { ...startedMap, [rowToConfirm._id]: true };
                setStartedMap(next);
                writeStartedMap(next);

                if (selectedDeviceId === rowToConfirm._id) setSelectedDeviceId('');
            }
        } catch (err) {
            console.error(err);

            const backendMsg = err?.response?.data?.message || '';
            if (backendMsg.includes('E11000') && backendMsg.includes('imei')) {
                message.info('Lịch bảo dưỡng của thiết bị này đã được xác nhận trước đó.');
                setConfirmOpen(false);
                setRowToConfirm(null);
                confirmForm.resetFields();
                return;
            }

            message.error('Xác nhận bảo dưỡng không thành công. Vui lòng thử lại.');
        } finally {
            setConfirming(false);
        }
    };

    const doSearch = async () => {
        await loadDevices({ license_plate: searchPlate.trim(), imei: searchImei.trim() });
        // Nếu device đang chọn bị filter mất thì clear
        setSelectedDeviceId('');
    };

    const doReload = async () => {
        await loadDevices({ license_plate: searchPlate.trim(), imei: searchImei.trim() });
    };

    const columns = [
        {
            title: 'Tên thiết bị',
            key: 'deviceName',
            width: 160,
            render: (_, row) => row?.device_category_id?.name || row?.device_category_id?.code || '-',
        },
        { title: 'SĐT thiết bị', dataIndex: 'phone_number', key: 'phone_number', width: 140, render: (v) => v || '-' },
        { title: 'SĐT chủ xe', key: 'ownerPhone', width: 140, render: (_, row) => row?.user_id?.phone || '-' },
        { title: 'Biển số', dataIndex: 'license_plate', key: 'license_plate', width: 140, render: (v) => v || '-' },
        { title: 'Tên lái xe', dataIndex: 'driver', key: 'driver', width: 140, render: (v) => v || '-' },
        { title: 'IMEI', dataIndex: 'imei', key: 'imei', width: 170, render: (v) => v || '-' },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 130,
            render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('DD-MM-YYYY') : '-'),
        },
        {
            title: 'Ngày hết hạn',
            dataIndex: 'date_exp',
            key: 'date_exp',
            width: 130,
            render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('DD-MM-YYYY') : 'Chưa cập nhật'),
        },
        {
            title: 'Trạng thái',
            key: 'started',
            width: 140,
            render: (_, row) => {
                const started = !!startedMap[row?._id];
                return started ? (
                    <Tag icon={<CheckCircleFilled />} color="green">
                        Đã kích hoạt
                    </Tag>
                ) : (
                    <Tag icon={<CloseCircleFilled />} color="red">
                        Chưa kích hoạt
                    </Tag>
                );
            },
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 140,
            render: (_, row) => (
                <Button type="primary" size="small" onClick={() => openConfirm(row)}>
                    Xác nhận
                </Button>
            ),
        },
    ];

    return (
        <div style={{ padding: 16 }}>
            <Title level={3} style={{ marginBottom: 4 }}>
                Kích hoạt bảo dưỡng
            </Title>
            <Text type="secondary">Thiết bị đã kích hoạt sẽ không còn hiện trong dropdown.</Text>

            {/* Select + 1 nút Kích hoạt */}
            <Card style={{ marginTop: 12, marginBottom: 12 }}>
                <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} lg={16}>
                        <Space direction="vertical" style={{ width: '100%' }} size={6}>
                            <Text strong>Chọn thiết bị</Text>

                            <Select
                                style={{ width: '100%' }}
                                loading={loadingDevices}
                                value={selectedDeviceId || undefined}
                                onChange={setSelectedDeviceId}
                                showSearch
                                optionFilterProp="label"
                                placeholder="Chọn thiết bị chưa kích hoạt..."
                                options={selectableDevices.map((d) => ({
                                    value: d._id,
                                    label: `${d.license_plate || d.imei} (IMEI: ${d.imei})`,
                                }))}
                            />

                            <Text type="secondary">Gợi ý: gõ để tìm theo biển số/IMEI.</Text>
                        </Space>
                    </Col>

                    <Col xs={24} lg={8}>
                        <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button
                                type="primary"
                                size="large"
                                loading={starting}
                                disabled={!selectedDeviceId}
                                onClick={handleStart}
                            >
                                Kích hoạt
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Card>

            {/* Search trên table: chỉ 2 ô + 2 nút (Tìm + Tải lại). Tải lại nằm kế Tìm */}
            <Card style={{ marginBottom: 12 }}>
                <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} lg={8}>
                        <Input
                            value={searchPlate}
                            onChange={(e) => setSearchPlate(e.target.value)}
                            placeholder="Tìm theo biển số..."
                            allowClear
                            onPressEnter={doSearch}
                        />
                    </Col>

                    <Col xs={24} lg={8}>
                        <Input
                            value={searchImei}
                            onChange={(e) => setSearchImei(e.target.value)}
                            placeholder="Tìm theo IMEI..."
                            allowClear
                            onPressEnter={doSearch}
                        />
                    </Col>

                    <Col xs={24} lg={8}>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={doSearch} loading={loadingDevices}>
                                Tìm
                            </Button>
                            <Button onClick={doReload} loading={loadingDevices}>
                                Tải lại
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Card>

            <Card title="Danh sách thiết bị">
                {loadingDevices ? (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <Spin />
                    </div>
                ) : devices.length === 0 ? (
                    <Empty description="Không có thiết bị" />
                ) : (
                    <Table
                        rowKey={(row) => row?._id}
                        columns={columns}
                        dataSource={devices}
                        scroll={{ x: 1200 }}
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                    />
                )}
            </Card>

            {/* ✅ CONFIRM MODAL giống code cũ */}
            <Modal
                title="Xác nhận bảo dưỡng"
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
                <div style={{ marginBottom: 12 }}>
                    <Text type="secondary">Thiết bị:</Text>{' '}
                    <Text strong>{rowToConfirm?.license_plate || rowToConfirm?.imei || '-'}</Text>
                    <br />
                    <Text type="secondary">IMEI:</Text> <Text strong>{rowToConfirm?.imei || '-'}</Text>
                </div>

                <Form layout="vertical" form={confirmForm}>
                    <Form.Item label="Ngày bảo dưỡng" name="maintenanceDate">
                        <DatePicker format="YYYY-MM-DD" allowClear style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item label="Ghi chú (không bắt buộc)" name="note">
                        <TextArea rows={3} placeholder="Nhập ghi chú nếu cần..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
