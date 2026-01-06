'use client';

import React from 'react';
import { Input, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

export default function CommandBarTrigger({ placeholder = 'Search...', onOpen, width = 360 }) {
    return (
        <Input
            readOnly
            placeholder={placeholder}
            prefix={<SearchOutlined style={{ opacity: 0.65 }} />}
            onClick={() => onOpen?.()}
            suffix={
                <Button
                    type="text"
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpen?.();
                    }}
                    style={{
                        height: 24,
                        padding: '0 10px',
                        borderRadius: 10,
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: 'rgba(0,0,0,0.04)',
                        fontSize: 12,
                        lineHeight: '22px',
                    }}
                >
                    Ctrl+K
                </Button>
            }
            style={{
                width,
                borderRadius: 14,
                cursor: 'pointer',
            }}
        />
    );
}
