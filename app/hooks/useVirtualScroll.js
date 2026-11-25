/**
 * useVirtualScroll.js
 * Hook cuon ao hoa (Virtual Scrolling / List Windowing) thuan React
 * Chi render cac phan tu nam trong khung nhin (+ overscan), giam 95% so luong DOM nodes
 * Dam bao toc do cuon 60 FPS du danh sach co 1.000 - 5.000 thiet bi.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * Hook quan ly danh sach cuon ao hoa
 * @param {Object} options - Tham so cau hinh
 * @param {number} options.totalCount - Tong so phan tu trong danh sach
 * @param {number} options.estimatedItemHeight - Chieu cao uoc luong cua moi item (pixel)
 * @param {number} options.overscanCount - So phan tu render them o tren/duoi de cuon khong bi chop
 * @returns {Object} - Ket qua tinh toan gom cac item can render va padding tren/duoi
 */
export const useVirtualScroll = ({
    totalCount = 0,
    estimatedItemHeight = 66,
    overscanCount = 4,
}) => {
    const scrollContainerRef = useRef(null);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(600);
    const animationFrameRef = useRef(null);

    // Lang nghe su kien cuon voi requestAnimationFrame de dat 60 FPS
    const handleScrollEvent = useCallback(() => {
        if (!scrollContainerRef.current) return;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
                setScrollOffset(scrollContainerRef.current.scrollTop);
            }
        });
    }, []);

    // Do dac chieu cao thuc te cua container khi mount va resize
    useEffect(() => {
        const containerElement = scrollContainerRef.current;
        if (!containerElement) return;

        const updateContainerDimensions = () => {
            if (containerElement) {
                setViewportHeight(containerElement.clientHeight || 600);
                setScrollOffset(containerElement.scrollTop || 0);
            }
        };

        updateContainerDimensions();

        const resizeObserver = new ResizeObserver(() => {
            updateContainerDimensions();
        });
        resizeObserver.observe(containerElement);

        containerElement.addEventListener('scroll', handleScrollEvent, { passive: true });

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            containerElement.removeEventListener('scroll', handleScrollEvent);
            resizeObserver.disconnect();
        };
    }, [handleScrollEvent]);

    // Tinh toan pham vi chi so can render trong viewport
    const { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight, virtualItems } = useMemo(() => {
        if (totalCount === 0) {
            return {
                startIndex: 0,
                endIndex: 0,
                topSpacerHeight: 0,
                bottomSpacerHeight: 0,
                virtualItems: [],
            };
        }

        const calculatedStartIndex = Math.max(
            0,
            Math.floor(scrollOffset / estimatedItemHeight) - overscanCount
        );

        const calculatedEndIndex = Math.min(
            totalCount - 1,
            Math.ceil((scrollOffset + viewportHeight) / estimatedItemHeight) + overscanCount
        );

        const topHeight = calculatedStartIndex * estimatedItemHeight;
        const bottomHeight = Math.max(0, (totalCount - 1 - calculatedEndIndex) * estimatedItemHeight);

        const visibleItemsList = [];
        for (let itemIndex = calculatedStartIndex; itemIndex <= calculatedEndIndex; itemIndex++) {
            visibleItemsList.push({
                index: itemIndex,
                offsetTop: itemIndex * estimatedItemHeight,
            });
        }

        return {
            startIndex: calculatedStartIndex,
            endIndex: calculatedEndIndex,
            topSpacerHeight: topHeight,
            bottomSpacerHeight: bottomHeight,
            virtualItems: visibleItemsList,
        };
    }, [totalCount, estimatedItemHeight, overscanCount, scrollOffset, viewportHeight]);

    const scrollToTop = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
        setScrollOffset(0);
    }, []);

    const totalCalculatedHeight = totalCount * estimatedItemHeight;

    return {
        scrollContainerRef,
        virtualItems,
        totalCalculatedHeight,
        topSpacerHeight,
        bottomSpacerHeight,
        startIndex,
        endIndex,
        scrollToTop,
    };
};
