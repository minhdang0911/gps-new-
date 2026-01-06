'use client';

import { useEffect, useRef } from 'react';
import { message, Progress, Button, Typography } from 'antd';

const { Text } = Typography;

export function useUndoDeleteToast() {
    const pendingRef = useRef(new Map());

    useEffect(() => {
        return () => {
            pendingRef.current.forEach((pd) => {
                try {
                    clearTimeout(pd.timer);
                    clearInterval(pd.interval);
                    message.destroy(pd.messageKey);
                } catch (_) {}
            });
            pendingRef.current.clear();
        };
    }, []);

    const start = ({
        id,
        item,
        ms = 5000,
        tickMs = 120,
        renderTitle, // (item) => ReactNode
        renderUndoText, // () => string
        renderCountdownText, // (remainMs) => ReactNode
        optimisticRemove, // () => void
        rollback, // () => void
        apiDelete, // async () => void
        onSuccess, // () => void
        onError, // (err) => void
    }) => {
        if (!id) return;
        if (pendingRef.current.has(id)) return;

        optimisticRemove?.();

        const messageKey = `undo-delete-${id}`;
        const startedAt = Date.now();

        const cleanup = () => {
            const pd = pendingRef.current.get(id);
            if (!pd) return;
            clearTimeout(pd.timer);
            clearInterval(pd.interval);
            message.destroy(pd.messageKey);
            pendingRef.current.delete(id);
        };

        const undo = () => {
            const pd = pendingRef.current.get(id);
            if (!pd) return;
            cleanup();
            rollback?.();
            message.success(pd.undoSuccessText || 'Hoàn tác thành công');
        };

        const render = (remainMs) => {
            const percent = Math.max(0, Math.min(100, Math.round(((ms - remainMs) / ms) * 100)));

            message.open({
                key: messageKey,
                duration: 0,
                type: 'warning',
                content: (
                    <div style={{ minWidth: 340 }}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 8,
                                alignItems: 'center',
                            }}
                        >
                            <span>{renderTitle ? renderTitle(item) : 'Deleting…'}</span>

                            <Button size="small" type="link" onClick={undo}>
                                {renderUndoText ? renderUndoText() : 'Undo'}
                            </Button>
                        </div>

                        <div style={{ marginTop: 6 }}>
                            <Progress percent={percent} size="small" showInfo={false} />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {renderCountdownText
                                    ? renderCountdownText(remainMs)
                                    : `Finalizing in ${Math.ceil(remainMs / 1000)}s`}
                            </Text>
                        </div>
                    </div>
                ),
            });
        };

        // show first
        render(ms);

        const interval = setInterval(() => {
            const elapsed = Date.now() - startedAt;
            const remain = Math.max(0, ms - elapsed);
            render(remain);
            if (remain <= 0) clearInterval(interval);
        }, tickMs);

        const timer = setTimeout(async () => {
            const pd = pendingRef.current.get(id);
            if (!pd) return;

            try {
                await apiDelete?.();
                cleanup();
                onSuccess?.();
            } catch (err) {
                cleanup();
                rollback?.();
                onError?.(err);
            }
        }, ms);

        pendingRef.current.set(id, {
            id,
            item,
            timer,
            interval,
            messageKey,
            undoSuccessText: 'Hoàn tác thành công',
        });
    };

    return { start };
}
