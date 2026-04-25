import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
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
import { deleteUser, fetchUsers, updateUser } from '../Core/services/user.service';
import { useAppStore } from '../Core/store/app.store';
import type { RoleOption, UserListItem } from '../Core/types/common';
import './AdminUsersPage.scss';

type EditFormValues = {
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

  const load = async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([
        fetchUsers(token),
        fetchRegistrationRoles(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch {
      message.error('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openEdit = (user: UserListItem) => {
    setEditUser(user);
    form.setFieldsValue({
      fullName: user.full_name,
      role: user.role,
      password: '',
    });
  };

  const handleSave = async (values: EditFormValues) => {
    if (!editUser || !token) {
      return;
    }
    setSaveLoading(true);
    try {
      const payload: { fullName?: string; role?: string; password?: string } = {};
      if (values.fullName !== editUser.full_name) {
        payload.fullName = values.fullName;
      }
      if (values.role !== editUser.role) {
        payload.role = values.role;
      }
      if (values.password) {
        payload.password = values.password;
      }

      if (Object.keys(payload).length === 0) {
        message.info('Нет изменений');
        setEditUser(null);
        return;
      }

      await updateUser(editUser.id, payload, token);
      message.success('Пользователь обновлён');
      setEditUser(null);
      void load();
    } catch {
      message.error('Не удалось сохранить изменения');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!token) {
      return;
    }
    try {
      await deleteUser(userId, token);
      message.success('Пользователь удалён');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      message.error('Не удалось удалить пользователя');
    }
  };

  const roleOptions = roles.map((r) => ({ value: r.value, label: r.title }));

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: 'Логин',
      dataIndex: 'username',
      key: 'username',
      width: 140,
    },
    {
      title: 'ФИО',
      dataIndex: 'full_name',
      key: 'full_name',
    },
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
      <Table
        rowKey="id"
        loading={loading}
        dataSource={users}
        columns={columns}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        scroll={{ x: 600 }}
      />

      <Modal
        title={`Редактировать: ${editUser?.username ?? ''}`}
        open={Boolean(editUser)}
        onCancel={() => setEditUser(null)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="fullName"
            label="ФИО"
            rules={[{ required: true, message: 'Введите ФИО' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="role"
            label="Роль"
            rules={[{ required: true, message: 'Выберите роль' }]}
          >
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
    </div>
  );
}
