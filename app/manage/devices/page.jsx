'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Card,
    Input,
    Button,
    Table,
    Space,
    Typography,
    Form,
    Row,
    Col,
    Modal,
    Descriptions,
    Select,
    message,
} from 'antd';

import {
    SearchOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ArrowLeftOutlined,
    EyeOutlined,
} from '@ant-design/icons';

import markerIcon from '../../assets/marker-red.png';

// API REAL
import { getDevices, createDevice, updateDevice, deleteDevice } from '../../lib/api/devices';
import { getDeviceCategories } from '../../lib/api/deviceCategory';
import { getVehicleCategories } from '../../lib/api/vehicleCategory';
import { getUserList } from '../../lib/api/user';

import { getLastCruise } from '../../lib/api/cruise';
import { getBatteryStatusByImei } from '../../lib/api/batteryStatus';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ManageDevicesPage() {
    const [loading, setLoading] = useState(false);
    const [LMap, setLMap] = useState(null);
    const [token, setToken] = useState('');
    const [currentRole, setCurrentRole] = useState('');

    // API DATA
    const [devices, setDevices] = useState([]);
    const [deviceCategories, setDeviceCategories] = useState([]);
    const [vehicleCategories, setVehicleCategories] = useState([]);
    const [userOptions, setUserOptions] = useState([]);

    const [cruiseInfo, setCruiseInfo] = useState(null);
    const [batteryInfo, setBatteryInfo] = useState(null);

    // FILTER STATE
    const [filters, setFilters] = useState({
        phone_number: '',
        license_plate: '',
        imei: '',
        driver: '',
    });

    // VIEW MODE
    const [viewMode, setViewMode] = useState('list'); // list | detail
    const [selectedDevice, setSelectedDevice] = useState(null);

    // MODAL STATE
    const [modalMode, setModalMode] = useState(null); // add | edit
    const [form] = Form.useForm();

    // MAP REF
    const mapRef = useRef(null);

    /* =========================
        LOAD LIST
    ========================= */
    const loadDevices = async () => {
        try {
            setLoading(true);
            const res = await getDevices(token, {
                page: 1,
                limit: 50,
                ...filters,
            });
            setDevices(res?.devices || []);
        } catch (err) {
            message.error('Không tải được danh sách thiết bị');
        } finally {
            setLoading(false);
        }
    };

    /* =========================
        LOAD OPTIONS
    ========================= */
    const loadOptions = async () => {
        try {
            const dc = await getDeviceCategories(token, { limit: 200 });
            setDeviceCategories(dc.items || []);

            const vc = await getVehicleCategories(token, { limit: 200 });
            setVehicleCategories(vc.items || []);

            const users = await getUserList({ limit: 300 });
            setUserOptions(users.items || []);
        } catch (err) {
            message.error('Không tải dữ liệu cấu hình');
        }
    };

    useEffect(() => {
        if (!token) return;
        loadDevices();
        loadOptions();
    }, [token]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setToken(localStorage.getItem('accessToken') || '');
            setCurrentRole(localStorage.getItem('role') || '');
        }
    }, []);

    /* =========================
        ADD
    ========================= */
    const openAdd = () => {
        if (currentRole !== 'administrator') return message.warning('Bạn không có quyền thêm thiết bị');

        setModalMode('add');
        form.resetFields();
    };

    /* =========================
        EDIT
    ========================= */
    const openEdit = (item) => {
        if (currentRole !== 'administrator') return message.warning('Bạn không có quyền sửa thiết bị');

        setModalMode('edit');
        setSelectedDevice(item);
        form.setFieldsValue({
            imei: item.imei,
            phone_number: item.phone_number,
            license_plate: item.license_plate,
            driver: item.driver,
            device_category_id: item.device_category_id?._id,
            vehicle_category_id: item.vehicle_category_id?._id,
            user_id: item.user_id?._id,
            distributor_id: item.distributor_id?._id,
        });
    };

    /* =========================
        API ERROR HANDLER
    ========================= */
    const extractErrorMsg = (err) => {
        const data = err?.response?.data;

        if (!data) return 'Lỗi không xác định';

        if (Array.isArray(data.errors)) return data.errors.join(', ');
        if (data.error) return data.error;
        if (data.message) return data.message;

        return 'Lỗi không xác định';
    };

    /* =========================
        PHONE VALIDATION
    ========================= */
    const validatePhone = (phone) => {
        if (!phone) return true;
        return /^(0[2-9][0-9]{8,9})$/.test(phone);
    };

    useEffect(() => {
        const loadLeaflet = async () => {
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');
            setLMap(L);
        };
        loadLeaflet();
    }, []);

    /* =========================
        SAVE
    ========================= */
    const handleSave = async () => {
        try {
            const values = await form.validateFields();

            if (!validatePhone(values.phone_number)) {
                return message.error('Số điện thoại không hợp lệ');
            }

            const payload = {
                imei: values.imei,
                phone_number: values.phone_number,
                license_plate: values.license_plate,
                driver: values.driver,
                device_category_id: values.device_category_id,
                vehicle_category_id: values.vehicle_category_id,
                user_id: values.user_id,
                distributor_id: values.distributor_id,
            };

            if (modalMode === 'add') {
                await createDevice(token, payload);
                message.success('Tạo thiết bị thành công');
            } else {
                await updateDevice(token, selectedDevice._id, payload);
                message.success('Cập nhật thiết bị thành công');
            }

            setModalMode(null);
            loadDevices();
        } catch (err) {
            message.error(extractErrorMsg(err));
        }
    };

    /* =========================
        DELETE
    ========================= */
    const handleDelete = (id) => {
        if (currentRole !== 'administrator') return message.warning('Bạn không có quyền xóa thiết bị');

        Modal.confirm({
            title: 'Xóa thiết bị này?',
            okType: 'danger',
            onOk: async () => {
                try {
                    await deleteDevice(token, id);
                    message.success('Xóa thành công');
                    loadDevices();
                } catch (err) {
                    message.error(extractErrorMsg(err));
                }
            },
        });
    };

    /* =========================
        SELECT DEVICE
    ========================= */
    const handleSelectDevice = async (item) => {
        if (currentRole === 'customer') return message.warning('Bạn không có quyền xem chi tiết');

        setSelectedDevice(item);
        setViewMode('detail');

        try {
            const cruise = await getLastCruise(token, item.imei);
            const battery = await getBatteryStatusByImei(token, item.imei);

            setCruiseInfo(cruise);
            setBatteryInfo(battery?.batteryStatus || null);
        } catch (err) {
            message.error('Không tải được dữ liệu hành trình / pin');
        }
    };

    const goBack = () => {
        setViewMode('list');
        setSelectedDevice(null);
        setCruiseInfo(null);
        setBatteryInfo(null);
    };

    /* =========================
        INIT MAP
    ========================= */
    useEffect(() => {
        if (viewMode !== 'detail' || !selectedDevice) return;

        if (!cruiseInfo) return;

        if (mapRef.current) {
            mapRef.current.remove();
        }

        const lat = cruiseInfo.lat || 10.75;
        const lon = cruiseInfo.lon || 106.6;

        const map = L.map('iky-device-map', {
            center: [lat, lon],
            zoom: 16,
            zoomControl: false,
        });

        mapRef.current = map;

        LMap.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        const mk = L.marker([lat, lon], {
            icon: L.icon({
                iconUrl: markerIcon.src,
                iconSize: [40, 40],
                iconAnchor: [20, 40],
            }),
        }).addTo(map);

        mk.bindPopup(
            `
            <b>IMEI:</b> ${selectedDevice.imei}<br/>
            <b>Biển số:</b> ${selectedDevice.license_plate || '-'}<br/>
            <b>Loại:</b> ${selectedDevice.device_category_id?.name || '-'}<br/>
            <b>Tốc độ:</b> ${cruiseInfo?.spd || 0} km/h<br/>
            <b>ACC:</b> ${cruiseInfo?.acc === 1 ? 'Đang chạy' : 'Tắt máy'}<br/>
            <b>Pin:</b> ${batteryInfo?.soc ?? '--'}%
        `,
        );

        setTimeout(() => map.invalidateSize(), 200);
    }, [viewMode, selectedDevice, cruiseInfo]);

    /* =========================
        TABLE COLUMNS
    ========================= */
    const columns = [
        {
            title: 'STT',
            width: 60,
            render: (_, __, index) => index + 1,
        },
        {
            title: 'IMEI',
            dataIndex: 'imei',
            render: (text, record) => (
                <Button type="link" onClick={() => handleSelectDevice(record)}>
                    {text}
                </Button>
            ),
        },
        {
            title: 'Loại thiết bị',
            dataIndex: 'device_category_id',
            render: (device) => device?.name || '-',
        },
        {
            title: 'SĐT',
            dataIndex: 'phone_number',
        },
        {
            title: 'Biển số',
            dataIndex: 'license_plate',
        },
        {
            title: 'Khách hàng',
            dataIndex: 'user_id',
            render: (u) => u?.email || 'Chưa gán',
        },
        {
            title: 'Đại lý',
            dataIndex: 'distributor_id',
            render: (u) => u?.username || '-',
        },
        {
            title: 'Active',
            dataIndex: 'active',
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            render: (v) => new Date(v).toLocaleString(),
        },
        {
            title: 'Xem',
            width: 60,
            render: (_, r) => <Button size="small" icon={<EyeOutlined />} onClick={() => handleSelectDevice(r)} />,
        },
        {
            title: 'Hành động',
            render: (_, r) =>
                currentRole === 'administrator' && (
                    <Space>
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
                            Sửa
                        </Button>
                        <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(r._id)}>
                            Xóa
                        </Button>
                    </Space>
                ),
        },
    ];

    /* =========================
        RENDER LIST MODE
    ========================= */
    const renderList = () => (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* HEADER */}
            <Row justify="space-between" align="middle">
                <Col>
                    <Title level={4}>Quản lý thiết bị</Title>
                </Col>
                <Col>
                    {currentRole === 'administrator' && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                            Thêm thiết bị
                        </Button>
                    )}
                </Col>
            </Row>

            {/* FILTER */}
            <Card>
                <Row gutter={[12, 12]}>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder="Số điện thoại"
                            value={filters.phone_number}
                            onChange={(e) => setFilters((f) => ({ ...f, phone_number: e.target.value }))}
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder="Biển số"
                            value={filters.license_plate}
                            onChange={(e) => setFilters((f) => ({ ...f, license_plate: e.target.value }))}
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder="IMEI"
                            value={filters.imei}
                            onChange={(e) => setFilters((f) => ({ ...f, imei: e.target.value }))}
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder="Lái xe"
                            value={filters.driver}
                            onChange={(e) => setFilters((f) => ({ ...f, driver: e.target.value }))}
                        />
                    </Col>
                </Row>

                <Row justify="end" style={{ marginTop: 12 }}>
                    <Button type="primary" icon={<SearchOutlined />} onClick={loadDevices}>
                        Tìm kiếm
                    </Button>
                </Row>
            </Card>

            {/* TABLE */}
            <Card>
                <Text strong>Danh sách thiết bị ({devices.length})</Text>
                <Table
                    dataSource={devices}
                    columns={columns}
                    rowKey="_id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    style={{ marginTop: 12 }}
                    scroll={{ x: 900 }}
                />
            </Card>
        </Space>
    );

    /* =========================
        RENDER DETAIL MODE
    ========================= */
    const renderDetail = () => (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space wrap>
                <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
                    Quay lại
                </Button>
                <Title level={4}>Thông tin chi tiết thiết bị</Title>
            </Space>

            <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                    <Card title="Thông tin thiết bị">
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="IMEI">{selectedDevice.imei}</Descriptions.Item>
                            <Descriptions.Item label="Số điện thoại">
                                {selectedDevice.phone_number || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Biển số">{selectedDevice.license_plate || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Lái xe">{selectedDevice.driver || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Loại thiết bị">
                                {selectedDevice.device_category_id?.name}
                            </Descriptions.Item>
                            <Descriptions.Item label="Firmware">{selectedDevice.version || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Pin">{batteryInfo?.soc ?? '--'}%</Descriptions.Item>
                            <Descriptions.Item label="Vận tốc">{cruiseInfo?.spd || 0} km/h</Descriptions.Item>
                            <Descriptions.Item label="ACC">
                                {cruiseInfo?.acc === 1 ? 'Đang chạy' : 'Tắt máy'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Vị trí">
                                {cruiseInfo?.lat}, {cruiseInfo?.lon}
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card title="Chủ sở hữu & Đại lý">
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="Khách hàng">
                                {selectedDevice.user_id ? selectedDevice.user_id.email : 'Chưa gán'}
                            </Descriptions.Item>

                            <Descriptions.Item label="Đại lý">
                                {selectedDevice.distributor_id ? selectedDevice.distributor_id.username : '-'}
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card style={{ marginTop: 16 }} title="Bản đồ thiết bị">
                        <div id="iky-device-map" style={{ height: 260 }} />
                    </Card>
                </Col>
            </Row>
        </Space>
    );

    return (
        <>
            {viewMode === 'list' ? renderList() : renderDetail()}

            {/* MODAL */}
            <Modal
                title={modalMode === 'add' ? 'Thêm thiết bị' : 'Sửa thiết bị'}
                open={!!modalMode}
                onCancel={() => setModalMode(null)}
                onOk={handleSave}
                okText="Lưu"
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="imei" label="IMEI" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>

                    <Form.Item name="phone_number" label="Số điện thoại">
                        <Input />
                    </Form.Item>

                    <Form.Item name="license_plate" label="Biển số">
                        <Input />
                    </Form.Item>

                    <Form.Item name="driver" label="Tên lái xe">
                        <Input />
                    </Form.Item>

                    <Form.Item name="device_category_id" label="Dòng thiết bị" rules={[{ required: true }]}>
                        <Select placeholder="Chọn dòng thiết bị">
                            {deviceCategories.map((d) => (
                                <Option key={d._id} value={d._id}>
                                    {d.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="vehicle_category_id" label="Dòng xe">
                        <Select placeholder="Chọn dòng xe">
                            {vehicleCategories.map((v) => (
                                <Option key={v._id} value={v._id}>
                                    {v.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="user_id" label="Khách hàng">
                        <Select allowClear placeholder="Chọn khách hàng">
                            {userOptions
                                .filter((u) => u.position === 'customer')
                                .map((u) => (
                                    <Option key={u._id} value={u._id}>
                                        {u.email} ({u.username})
                                    </Option>
                                ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="distributor_id" label="Đại lý">
                        <Select allowClear placeholder="Chọn đại lý">
                            {userOptions
                                .filter((u) => u.position === 'distributor')
                                .map((u) => (
                                    <Option key={u._id} value={u._id}>
                                        {u.email} ({u.username})
                                    </Option>
                                ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
