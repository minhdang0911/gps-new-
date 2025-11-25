import api from './axios';

// =============================
// TẠO USER
// POST /user/create
// =============================
export const createUser = async (data) => {
    const res = await api.post('user', data, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
};

// =============================
// UPDATE USER
// PUT /user/update/:id
// =============================
export const updateUser = async (id, data) => {
    const res = await api.put(`user/${id}`, data, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
};

// =============================
// DELETE USER
// DELETE /user/:id
// =============================
export const deleteUser = async (id) => {
    const res = await api.delete(`/user/${id}`);
    return res.data;
};

// =============================
// GET USER INFO
// GET /user/infor/:id
// =============================
export const getUserInfo = async (id) => {
    const res = await api.get(`user/${id}`);
    return res.data;
};

// =============================
// GET USER LIST
// GET /users?username=&phone=&email=&page=&limit=
// =============================
export const getUserList = async (params = {}) => {
    const res = await api.get('/users', { params });
    return res.data;
};
