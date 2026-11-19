import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import { useEffect, useState } from 'react';

import { fetchRegistrationRoles } from '../Core/services/auth.service';
import { createUser, deleteUser, fetchUsers, updateUser } from '../Core/services/user.service';
import type { CreateUserPayload } from '../Core/services/user.service';
import { useAppStore } from '../Core/store/app.store';
import type { RoleOption, UserListItem } from '../Core/types/common';
import './AdminUsersPage.scss';

type EditFormValues = {
  fullName: string;
  role: string;
  password: string;
};

type CreateFormValues = {
  username: string;
  fullName: string;
  role: string;
  password: string;
};

export function AdminUsersPage() {
  const token = useAppStore((state) => state.token);
  const currentUser = useAppStore((state) => state.user);

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [form] = Form.useForm<EditFormValues>();

  // Создание пользователя
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm<CreateFormValues>();

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([
        fetchUsers(token),
        fetchRegistrationRoles(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch {
      void message.error('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Редактирование ────────────────────────────────────────────────────────

  const openEdit = (user: UserListItem) => {
    setEditUser(user);
    form.setFieldsValue({ fullName: user.full_name, role: user.role, password: '' });
  };

  const handleSave = async (values: EditFormValues) => {
    if (!editUser || !token) return;
    setSaveLoading(true);
    try {
      const payload: { fullName?: string; role?: string; password?: string } = {};
      if (values.fullName !== editUser.full_name) payload.fullName = values.fullName;
      if (values.role !== editUser.role) payload.role = values.role;
      if (values.password) payload.password = values.password;

      if (Object.keys(payload).length === 0) {
        void message.info('Нет изменений');
        setEditUser(null);
        return;
      }

      await updateUser(editUser.id, payload, token);
      void message.success('Пользователь обновлён');
      setEditUser(null);
      void load();
    } catch {
      void message.error('Не удалось сохранить изменения');
    } finally {
      setSaveLoading(false);
    }
  };

  // ── Создание ──────────────────────────────────────────────────────────────

  const handleCreate = async (values: CreateFormValues) => {
    if (!token) return;
    setCreateLoading(true);
    try {
      const payload: CreateUserPayload = {
        username: values.username.trim(),
        fullName: values.fullName.trim(),
        role: values.role,
        password: values.password,
      };
      await createUser(payload, token);
      void message.success('Пользователь создан');
      setCreateOpen(false);
      createForm.resetFields();
      void load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Не удалось создать пользователя';
      void message.error(msg);
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Удаление ──────────────────────────────────────────────────────────────

  const handleDelete = async (userId: number) => {
    if (!token) return;
    try {
      await deleteUser(userId, token);
      void message.success('Пользователь удалён');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      void message.error('Не удалось удалить пользователя');
    }
  };

  const roleOptions = roles.map((r) => ({ value: r.value, label: r.title }));

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Логин', dataIndex: 'username', key: 'username', width: 140 },
    { title: 'ФИО', dataIndex: 'full_name', key: 'full_name' },
    {
      title: 'Роль',
      dataIndex: 'role_title',
      key: 'role_title',
      width: 200,
      render: (title: string) => <Tag color="blue">{title}</Tag>,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: UserListItem) => (
        <div className="admin-users-page__actions">
          <Tooltip title="Редактировать">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить пользователя?"
            description={`Логин: ${record.username}`}
            okText="Да"
            cancelText="Нет"
            disabled={record.id === currentUser?.id}
            onConfirm={() => void handleDelete(record.id)}
          >
            <Tooltip title={record.id === currentUser?.id ? 'Нельзя удалить себя' : 'Удалить'}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={record.id === currentUser?.id}
              />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-users-page">
      <div className="admin-users-page__toolbar">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          Создать пользователя
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={users}
        columns={columns}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        scroll={{ x: 600 }}
      />

      {/* Модалка редактирования */}
      <Modal
        title={`Редактировать: ${editUser?.username ?? ''}`}
        open={Boolean(editUser)}
        onCancel={() => setEditUser(null)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="fullName" label="ФИО" rules={[{ required: true, message: 'Введите ФИО' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true, message: 'Выберите роль' }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item
            name="password"
            label="Новый пароль"
            extra="Оставьте пустым, чтобы не менять пароль"
          >
            <Input.Password placeholder="Новый пароль" />
          </Form.Item>
          <div className="admin-users-page__modal-footer">
            <Button onClick={() => setEditUser(null)}>Отмена</Button>
            <Button type="primary" htmlType="submit" loading={saveLoading}>
              Сохранить
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Модалка создания */}
      <Modal
        title="Создать пользователя"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createLoading}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="fullName"
            label="ФИО"
            rules={[{ required: true, message: 'Введите ФИО' }]}
          >
            <Input placeholder="Иванов Иван Иванович" />
          </Form.Item>
          <Form.Item
            name="username"
            label="Логин"
            rules={[{ required: true, message: 'Введите логин' }]}
          >
            <Input placeholder="ivanov_ii" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="role"
            label="Роль"
            rules={[{ required: true, message: 'Выберите роль' }]}
          >
            <Select
              options={roleOptions}
              showSearch
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              placeholder="Выберите роль"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: 'Введите пароль' }, { min: 6, message: 'Минимум 6 символов' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
