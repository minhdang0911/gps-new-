import '@testing-library/jest-dom';

// ---- Ant Design / rc-* polyfills for jsdom ----

// matchMedia (antd responsive, dropdown, etc.)
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {}, // deprecated
        removeListener: () => {}, // deprecated
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
});

// ResizeObserver (antd components use it)
class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.ResizeObserver = window.ResizeObserver || ResizeObserver;

// getComputedStyle (some rc components rely on it)
window.getComputedStyle =
    window.getComputedStyle ||
    (() => ({
        getPropertyValue: () => '',
    }));

// scrollTo (sometimes called)
window.scrollTo = window.scrollTo || (() => {});
