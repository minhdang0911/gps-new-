// app/manage/user/hooks/useManageUserColumns.js
import React, { useMemo } from 'react';
import { Space, Button } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';

export function useManageUserColumns({
    translation,
    roleLabelMap,
    canEdit,
    canDelete,
    canView,
    onEditUser,
    onDeleteUser,
    onViewUser,
}) {
    return useMemo(
        () => [
            {
                title: translation.table.username,
                dataIndex: 'username',
                sorter: (a, b) => (a.username || '').localeCompare(b.username || ''),
            },
            {
                title: translation.table.name,
                dataIndex: 'name',
                sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
            },
            {
                title: translation.table.email,
                dataIndex: 'email',
                sorter: (a, b) => (a.email || '').localeCompare(b.email || ''),
            },
            {
                title: translation.table.phone,
                dataIndex: 'phone',
                sorter: (a, b) => (a.phone || '').localeCompare(b.phone || ''),
            },
            {
                title: translation.table.role,
                dataIndex: 'position',
                sorter: (a, b) => (a.position || '').localeCompare(b.position || ''),
                render: (position) => roleLabelMap[position] || position || '',
            },
            {
                title: translation.table.actions,
                fixed: 'right',
                width: 240,
                render: (_, record) => (
                    <Space data-tour="rowActions">
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => onEditUser(record)}
                            disabled={!canEdit}
                            data-tour="editBtn"
                        >
                            {translation.actions.edit}
                        </Button>
                        <Button
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => onDeleteUser(record)}
                            disabled={!canDelete}
                            data-tour="deleteBtn"
                        >
                            {translation.actions.delete}
                        </Button>
                        <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => onViewUser(record)}
                            disabled={!canView}
                            data-tour="viewBtn"
                        >
                            {translation.actions.view}
                        </Button>
                    </Space>
                ),
            },
        ],
        [translation, roleLabelMap, canEdit, canDelete, canView, onEditUser, onDeleteUser, onViewUser]
    );
}
