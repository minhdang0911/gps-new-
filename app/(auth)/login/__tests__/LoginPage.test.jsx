import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LoginPage from '../page';

// ---- Mocks ----

// next/image
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props) => {
        const { priority, fill, sizes, quality, placeholder, blurDataURL, ...rest } = props;
        // eslint-disable-next-line @next/next/no-img-element
        return <img {...rest} alt={props.alt || 'image'} />;
    },
}));

// next/navigation
const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: pushMock }),
    usePathname: () => '/login',
}));

// antd message
const messageSuccessMock = jest.fn();
const messageErrorMock = jest.fn();

jest.mock('antd', () => {
    const actual = jest.requireActual('antd');
    return {
        ...actual,
        message: {
            success: (...args) => messageSuccessMock(...args),
            error: (...args) => messageErrorMock(...args),
        },
    };
});

// login api
const loginMock = jest.fn();
jest.mock('../../../lib/api/auth', () => ({
    login: (...args) => loginMock(...args),
}));

// zustand store
const setUserMock = jest.fn();
jest.mock('../../../stores/authStore', () => ({
    useAuthStore: (selector) => selector({ setUser: setUserMock }),
}));

describe('LoginPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('login thành công: iky_demo / 12345678 -> gọi login đúng args + setUser + redirect', async () => {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });

        loginMock.mockResolvedValueOnce({
            user: { _id: 'u1', position: 'admin' },
        });

        render(<LoginPage />);

        await user.type(screen.getByLabelText('Tên đăng nhập'), 'iky_demo');
        await user.type(screen.getByLabelText('Mật khẩu'), '12345678'); // ✅ đúng 1-8
        await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

        await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));

        // ✅ ASSERT QUAN TRỌNG: nếu bạn sửa pass thành 1234567 thì test FAIL tại đây
        const [usernameArg, passwordArg, deviceArg] = loginMock.mock.calls[0];
        expect(usernameArg).toBe('iky_demo');
        expect(passwordArg).toBe('12345678');
        expect(typeof deviceArg).toBe('string');
        expect(deviceArg.startsWith('dev_')).toBe(true);

        // side effects
        expect(setUserMock).toHaveBeenCalledWith({ _id: 'u1', position: 'admin' });
        expect(messageSuccessMock).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'Đăng nhập thành công!',
            }),
        );

        // redirect sau 600ms
        await act(async () => {
            jest.advanceTimersByTime(600);
        });
        expect(pushMock).toHaveBeenCalledWith('/');
    });

    test('login thất bại: iky_demo / sai pass -> message.error + không redirect', async () => {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });

        loginMock.mockRejectedValueOnce({
            response: { data: { message: 'Invalid credentials' } },
        });

        render(<LoginPage />);

        await user.type(screen.getByLabelText('Tên đăng nhập'), 'iky_demo');
        await user.type(screen.getByLabelText('Mật khẩu'), '1234567'); // ❌ sai
        await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

        await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));

        // ✅ verify gọi login đúng args của case sai pass
        const [usernameArg, passwordArg, deviceArg] = loginMock.mock.calls[0];
        expect(usernameArg).toBe('iky_demo');
        expect(passwordArg).toBe('1234567');
        expect(typeof deviceArg).toBe('string');
        expect(deviceArg.startsWith('dev_')).toBe(true);

        await waitFor(() => expect(messageErrorMock).toHaveBeenCalled());
        expect(messageErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'Invalid credentials',
            }),
        );

        // không được setUser, không được redirect
        expect(setUserMock).not.toHaveBeenCalled();

        // chạy time cho chắc (nếu có setTimeout)
        await act(async () => {
            jest.advanceTimersByTime(1000);
        });
        expect(pushMock).not.toHaveBeenCalled();
    });
});
