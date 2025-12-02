'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    DownloadOutlined,
} from '@ant-design/icons';

import { usePathname } from 'next/navigation';

import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';

import markerIcon from '../../assets/marker-red.png';
import { getTodayForFileName } from '../../util/FormatDate';

// API REAL
import { getDevices, createDevice, updateDevice, deleteDevice } from '../../lib/api/devices';
import { getDeviceCategories } from '../../lib/api/deviceCategory';
import { getVehicleCategories } from '../../lib/api/vehicleCategory';
import { getUserList } from '../../lib/api/user';

import { getLastCruise } from '../../lib/api/cruise';
import { getBatteryStatusByImei } from '../../lib/api/batteryStatus';

// locales
import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

const locales = { vi, en };

const { Title, Text } = Typography;
const { Option } = Select;

export default function ManageDevicesPage() {
    const pathname = usePathname() || '/';

    const [loading, setLoading] = useState(false);
    const [LMap, setLMap] = useState(null);
    const [token, setToken] = useState('');
    const [currentRole, setCurrentRole] = useState('');

    // ===== LANG =====
    const [isEn, setIsEn] = useState(false);

    // detect /en ở cuối path: /manage/devices/en
    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    // sync lang theo URL + localStorage (same pattern Navbar/StatusBar)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (isEnFromPath) {
            setIsEn(true);
            localStorage.setItem('iky_lang', 'en');
        } else {
            const saved = localStorage.getItem('iky_lang');
            setIsEn(saved === 'en');
        }
    }, [isEnFromPath]);

    const t = isEn ? locales.en.manageDevices : locales.vi.manageDevices;

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
                limit: 200,
                ...filters,
            });
            setDevices(res?.devices || []);
        } catch (err) {
            message.error(t.loadError);
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

            const users = await getUserList({ limit: 3000 });
            setUserOptions(users.items || []);
        } catch (err) {
            message.error(t.configLoadError);
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
        EXPORT EXCEL (xlsx-js-style)
    ========================= */
    const exportExcel = () => {
        try {
            if (!devices.length) {
                return message.warning(t.noData);
            }

            // Giữ nguyên kiểu mapping VI cho file, cho chắc k hư rule cũ
            const excelData = devices.map((d) => ({
                IMEI: d.imei,
                'Loại thiết bị': d.device_category_id?.name || '-',
                'Số ĐT': d.phone_number || '-',
                'Biển số': d.license_plate || '-',
                KháchHàng: d.user_id?.email || 'Chưa gán',
                ĐạiLý: d.distributor_id?.username || '-',
                Active: d.active ? 'Có' : 'Không',
                NgàyTạo: new Date(d.createdAt).toLocaleString('vi-VN'),
                Driver: d.driver || '-',
            }));

            const ws = XLSX.utils.json_to_sheet(excelData, { origin: 'A2' });
            const headers = Object.keys(excelData[0]);

            const title = 'Báo cáo danh sách thiết bị';
            ws['A1'] = { v: title, t: 's' };
            ws['!merges'] = [
                {
                    s: { r: 0, c: 0 },
                    e: { r: 0, c: headers.length - 1 },
                },
            ];

            ws['A1'].s = {
                font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '4F81BD' } },
                alignment: { horizontal: 'center', vertical: 'center' },
            };

            ws['!rows'] = [
                { hpt: 28 }, // row 1
                { hpt: 22 }, // row 2
            ];

            // HEADER ROW
            headers.forEach((h, idx) => {
                const cellRef = XLSX.utils.encode_cell({ r: 1, c: idx }); // row index = 1 (dòng 2)
                if (!ws[cellRef]) return;

                ws[cellRef].s = {
                    font: { bold: true, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: '4F81BD' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } },
                    },
                };
            });

            const range = XLSX.utils.decode_range(ws['!ref']);
            const activeCol = headers.indexOf('Active');
            const khCol = headers.indexOf('KháchHàng');

            for (let R = range.s.r; R <= range.e.r; R++) {
                for (let C = range.s.c; C <= range.e.c; C++) {
                    const ref = XLSX.utils.encode_cell({ r: R, c: C });
                    const cell = ws[ref];
                    if (!cell) continue;

                    cell.s = cell.s || {};
                    cell.s.alignment = { horizontal: 'center', vertical: 'center' };
                    cell.s.border = {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } },
                    };

                    if (R > 1) {
                        if (R % 2 === 0) {
                            cell.s.fill = cell.s.fill || {};
                            cell.s.fill.fgColor = cell.s.fill.fgColor || { rgb: 'F9F9F9' };
                        }

                        if (C === activeCol && String(cell.v).trim() === 'Không') {
                            cell.s.fill = { fgColor: { rgb: 'FFC7CE' } };
                        }

                        if (C === khCol && String(cell.v).trim() === 'Chưa gán') {
                            cell.s.fill = { fgColor: { rgb: 'FFF2CC' } };
                        }
                    }
                }
            }

            ws['!cols'] = headers.map((key) => {
                const maxLen = Math.max(key.length, ...excelData.map((row) => String(row[key] || '').length));
                return { wch: maxLen + 4 };
            });

            ws['!autofilter'] = {
                ref: XLSX.utils.encode_range({
                    s: { r: 1, c: 0 },
                    e: { r: range.e.r, c: range.e.c },
                }),
            };

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Devices');

            const excelBuffer = XLSX.write(wb, {
                bookType: 'xlsx',
                type: 'array',
                cellStyles: true,
            });

            saveAs(new Blob([excelBuffer]), `DanhSachThietBi_${getTodayForFileName()}.xlsx`);

            message.success(t.exportSuccess || 'Xuất Excel thành công');
        } catch (err) {
            console.error(err);
            message.error(t.exportFailed || 'Xuất Excel thất bại');
        }
    };

    /* =========================
        ADD
    ========================= */
    const openAdd = () => {
        if (currentRole !== 'administrator') return message.warning(t.noPermissionAdd);

        setModalMode('add');
        form.resetFields();
    };

    /* =========================
        EDIT
    ========================= */
    const openEdit = (item) => {
        if (currentRole !== 'administrator') return message.warning(t.noPermissionEdit);

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

        if (!data) return isEn ? 'Unknown error' : 'Lỗi không xác định';

        if (Array.isArray(data.errors)) return data.errors.join(', ');
        if (data.error) return data.error;
        if (data.message) return data.message;

        return isEn ? 'Unknown error' : 'Lỗi không xác định';
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
                return message.error(t.invalidPhone || 'Số điện thoại không hợp lệ');
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
                message.success(t.createSuccess);
            } else {
                await updateDevice(token, selectedDevice._id, payload);
                message.success(t.updateSuccess);
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
        if (currentRole !== 'administrator') return message.warning(t.noPermissionDelete);

        Modal.confirm({
            title: t.deleteConfirm,
            okType: 'danger',
            onOk: async () => {
                try {
                    await deleteDevice(token, id);
                    message.success(t.deleteSuccess);
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
        if (currentRole === 'customer') return message.warning(t.noPermissionDetail);

        setSelectedDevice(item);
        setViewMode('detail');

        try {
            const cruise = await getLastCruise(token, item.imei);
            const battery = await getBatteryStatusByImei(token, item.imei);

            setCruiseInfo(cruise);
            setBatteryInfo(battery?.batteryStatus || null);
        } catch (err) {
            message.error(isEn ? 'Failed to load device data' : 'Không tải được dữ liệu hành trình / pin');
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
        if (!LMap) return;

        if (mapRef.current) {
            mapRef.current.remove();
        }

        const lat = cruiseInfo.lat || 10.75;
        const lon = cruiseInfo.lon || 106.6;

        const map = LMap.map('iky-device-map', {
            center: [lat, lon],
            zoom: 16,
            zoomControl: false,
        });

        mapRef.current = map;

        LMap.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        const mk = LMap.marker([lat, lon], {
            icon: LMap.icon({
                iconUrl: markerIcon.src,
                iconSize: [40, 40],
                iconAnchor: [20, 40],
            }),
        }).addTo(map);

        mk.bindPopup(
            `
            <b>${t.imei}:</b> ${selectedDevice.imei}<br/>
            <b>${t.plate}:</b> ${selectedDevice.license_plate || '-'}<br/>
            <b>${t.deviceType}:</b> ${selectedDevice.device_category_id?.name || '-'}<br/>
            <b>${t.speed}:</b> ${cruiseInfo?.spd || 0} km/h<br/>
            <b>${t.acc}:</b> ${cruiseInfo?.acc === 1 ? t.running : t.stopped}<br/>
            <b>${t.battery}:</b> ${batteryInfo?.soc ?? '--'}%
        `,
        );

        setTimeout(() => map.invalidateSize(), 200);
    }, [viewMode, selectedDevice, cruiseInfo, batteryInfo, LMap]);

    /* =========================
        TABLE COLUMNS (SORTER)
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
            sorter: (a, b) => a.imei.localeCompare(b.imei),
            render: (text, record) => (
                <Button type="link" onClick={() => handleSelectDevice(record)}>
                    {text}
                </Button>
            ),
        },
        {
            title: t.deviceType,
            dataIndex: 'device_category_id',
            sorter: (a, b) => (a.device_category_id?.name || '').localeCompare(b.device_category_id?.name || ''),
            render: (d) => d?.name || '-',
        },
        {
            title: t.phone,
            dataIndex: 'phone_number',
            sorter: (a, b) => (a.phone_number || '').localeCompare(b.phone_number || ''),
        },
        {
            title: t.plate,
            dataIndex: 'license_plate',
            sorter: (a, b) => (a.license_plate || '').localeCompare(b.license_plate || ''),
        },
        {
            title: t.driver,
            dataIndex: 'driver',
            sorter: (a, b) => (a.driver || '').localeCompare(b.driver || ''),
        },
        {
            title: t.customer,
            dataIndex: 'user_id',
            sorter: (a, b) => (a.user_id?.email || '').localeCompare(b.user_id?.email || ''),
            render: (u) => u?.email || t.notAssigned,
        },
        {
            title: t.distributor,
            dataIndex: 'distributor_id',
            sorter: (a, b) => (a.distributor_id?.username || '').localeCompare(b.distributor_id?.username || ''),
            render: (u) => u?.username || '-',
        },
        {
            title: t.createdDate,
            dataIndex: 'createdAt',
            sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
            render: (v) => new Date(v).toLocaleString(isEn ? 'en-US' : 'vi-VN'),
        },
        {
            title: t.view,
            width: 60,
            render: (_, r) => <Button size="small" icon={<EyeOutlined />} onClick={() => handleSelectDevice(r)} />,
        },
        {
            title: `${t.edit}/${t.delete}`,
            render: (_, r) =>
                currentRole === 'administrator' && (
                    <Space>
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
                            {t.edit}
                        </Button>
                        <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(r._id)}>
                            {t.delete}
                        </Button>
                    </Space>
                ),
        },
    ];

    /* =========================
        RENDER LIST MODE
    ========================= */
    const renderList = () => (
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Row justify="space-between" align="middle">
                <Col>
                    <Title level={4}>{t.title}</Title>
                </Col>
                <Col>
                    <Space>
                        <Button icon={<DownloadOutlined />} onClick={exportExcel}>
                            {t.exportExcel}
                        </Button>

                        {currentRole === 'administrator' && (
                            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                                {t.addDevice}
                            </Button>
                        )}
                    </Space>
                </Col>
            </Row>

            <Card>
                <Row gutter={[12, 12]}>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder={t.filters.phone}
                            value={filters.phone_number}
                            onChange={(e) => setFilters((f) => ({ ...f, phone_number: e.target.value }))}
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder={t.filters.plate}
                            value={filters.license_plate}
                            onChange={(e) => setFilters((f) => ({ ...f, license_plate: e.target.value }))}
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder={t.filters.imei}
                            value={filters.imei}
                            onChange={(e) => setFilters((f) => ({ ...f, imei: e.target.value }))}
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Input
                            placeholder={t.filters.driver}
                            value={filters.driver}
                            onChange={(e) => setFilters((f) => ({ ...f, driver: e.target.value }))}
                        />
                    </Col>
                </Row>

                <Row justify="end" style={{ marginTop: 12 }}>
                    <Button type="primary" icon={<SearchOutlined />} onClick={loadDevices}>
                        {t.search}
                    </Button>
                </Row>
            </Card>

            <Card>
                <Text strong>
                    {t.deviceList} ({devices.length})
                </Text>
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
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <Space wrap>
                <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
                    {t.back}
                </Button>
                <Title level={4}>{t.detailTitle}</Title>
            </Space>

            <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                    <Card title={t.deviceInfo}>
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label={t.imei}>{selectedDevice.imei}</Descriptions.Item>
                            <Descriptions.Item label={t.phone}>{selectedDevice.phone_number || '-'}</Descriptions.Item>
                            <Descriptions.Item label={t.plate}>{selectedDevice.license_plate || '-'}</Descriptions.Item>
                            <Descriptions.Item label={t.driver}>{selectedDevice.driver || '-'}</Descriptions.Item>
                            <Descriptions.Item label={t.deviceType}>
                                {selectedDevice.device_category_id?.name}
                            </Descriptions.Item>
                            <Descriptions.Item label={t.firmware}>{selectedDevice.version || '-'}</Descriptions.Item>
                            <Descriptions.Item label={t.battery}>{batteryInfo?.soc ?? '--'}%</Descriptions.Item>
                            <Descriptions.Item label={t.speed}>{cruiseInfo?.spd || 0} km/h</Descriptions.Item>
                            <Descriptions.Item label={t.acc}>
                                {cruiseInfo?.acc === 1 ? t.running : t.stopped}
                            </Descriptions.Item>
                            <Descriptions.Item label={t.position}>
                                {cruiseInfo?.lat}, {cruiseInfo?.lon}
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card title={t.ownerInfo}>
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label={t.customer}>
                                {selectedDevice.user_id ? selectedDevice.user_id.email : t.notAssigned}
                            </Descriptions.Item>

                            <Descriptions.Item label={t.distributor}>
                                {selectedDevice.distributor_id ? selectedDevice.distributor_id.username : '-'}
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card style={{ marginTop: 16 }} title={t.mapTitle}>
                        <div id="iky-device-map" style={{ height: 260 }} />
                    </Card>
                </Col>
            </Row>
        </Space>
    );

    return (
        <>
            {viewMode === 'list' ? renderList() : renderDetail()}

            <Modal
                title={modalMode === 'add' ? t.modal.addTitle : t.modal.editTitle}
                open={!!modalMode}
                onCancel={() => setModalMode(null)}
                onOk={handleSave}
                okText={t.save}
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="imei" label="IMEI" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>

                    <Form.Item name="phone_number" label={t.phone}>
                        <Input />
                    </Form.Item>

                    <Form.Item name="license_plate" label={t.plate}>
                        <Input />
                    </Form.Item>

                    <Form.Item name="driver" label={t.driver}>
                        <Input />
                    </Form.Item>

                    <Form.Item name="device_category_id" label={t.deviceType} rules={[{ required: true }]}>
                        <Select placeholder={t.modal.selectDeviceType}>
                            {deviceCategories.map((d) => (
                                <Option key={d._id} value={d._id}>
                                    {d.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="vehicle_category_id" label={t.modal.selectVehicleType}>
                        <Select placeholder={t.modal.selectVehicleType}>
                            {vehicleCategories.map((v) => (
                                <Option key={v._id} value={v._id}>
                                    {v.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="user_id" label={t.customer}>
                        <Select allowClear placeholder={t.modal.selectCustomer}>
                            {userOptions
                                .filter((u) => u.position === 'customer')
                                .map((u) => (
                                    <Option key={u._id} value={u._id}>
                                        {u.email} ({u.username})
                                    </Option>
                                ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="distributor_id" label={t.distributor}>
                        <Select allowClear placeholder={t.modal.selectDistributor}>
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
