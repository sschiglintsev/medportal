import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import {
  createDepartment,
  deleteDepartment,
  fetchDepartments,
  updateDepartment,
} from '../Core/services/incident.service';
import { formatDateTime } from '../Core/date.utils';
import { useAppStore } from '../Core/store/app.store';
import type { Department } from '../Core/types/common';
import './AdminDepartmentsPage.scss';

type FormValues = {
  name: string;
  care_type?: string;
};

export function AdminDepartmentsPage() {
  const [form] = Form.useForm<FormValues>();
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Department | null>(null);
  const [filterName, setFilterName] = useState('');
  const [filterCareType, setFilterCareType] = useState<string | undefined>(undefined);
  const token = useAppStore((state) => state.token);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const data = await fetchDepartments();
      setItems(data);
    } catch {
      message.error('Не удалось загрузить отделения');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDepartments();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (item: Department) => {
    setEditingItem(item);
    form.setFieldsValue({ name: item.name, care_type: item.care_type ?? undefined });
    setModalOpen(true);
  };

  const handleCancel = () => {
    setModalOpen(false);
    setEditingItem(null);
    form.resetFields();
  };

  const onFinish = async (values: FormValues) => {
    if (!token) {
      message.error('Требуется авторизация');
      return;
    }
    setSubmitting(true);
    try {
      if (editingItem) {
        await updateDepartment(editingItem.id, { name: values.name.trim(), care_type: values.care_type }, { token });
        message.success('Отделение обновлено');
      } else {
        await createDepartment({ name: values.name.trim(), care_type: values.care_type }, { token });
        message.success('Отделение добавлено');
      }
      handleCancel();
      await loadDepartments();
    } catch {
      message.error(editingItem ? 'Не удалось обновить отделение' : 'Не удалось добавить отделение');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    try {
      await deleteDepartment(id, { token });
      message.success('Отделение удалено');
      await loadDepartments();
    } catch {
      message.error('Не удалось удалить отделение. Возможно, оно используется в событиях.');
    }
  };

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchName = item.name.toLowerCase().includes(filterName.toLowerCase());
      const matchCare = !filterCareType || item.care_type === filterCareType;
      return matchName && matchCare;
    });
  }, [items, filterName, filterCareType]);

  return (
    <section className="admin-departments-page">
      <div className="admin-departments-page__toolbar">
        <Space wrap>
          <Input
            placeholder="Поиск по названию"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
          <Select
            placeholder="Вид медицинской помощи"
            value={filterCareType}
            onChange={(val) => setFilterCareType(val)}
            allowClear
            style={{ width: 220 }}
          >
            <Select.Option value="Стационар">Стационар</Select.Option>
            <Select.Option value="Поликлиника">Поликлиника</Select.Option>
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
          Добавить
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', key: 'id', width: '8%' },
          { title: 'Название', dataIndex: 'name', key: 'name' },
          {
            title: 'Вид медицинской помощи',
            dataIndex: 'care_type',
            key: 'care_type',
            width: '22%',
            render: (value: string | null) => value ?? '—',
          },
          {
            title: 'Создано',
            dataIndex: 'created_at',
            key: 'created_at',
            width: '18%',
            render: (value: string) => formatDateTime(value),
          },
          {
            title: '',
            key: 'actions',
            width: '12%',
            render: (_: unknown, record: Department) => (
              <Space>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEditModal(record)}
                />
                <Popconfirm
                  title="Удалить отделение?"
                  description="Это действие нельзя отменить."
                  okText="Удалить"
                  cancelText="Отмена"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void handleDelete(record.id)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingItem ? 'Изменить отделение' : 'Добавить отделение'}
        open={modalOpen}
        onCancel={handleCancel}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: 'Введите название отделения' }]}
          >
            <Input placeholder="Название отделения" />
          </Form.Item>
          <Form.Item name="care_type" label="Вид медицинской помощи">
            <Select placeholder="Выберите вид" allowClear>
              <Select.Option value="Стационар">Стационар</Select.Option>
              <Select.Option value="Поликлиника">Поликлиника</Select.Option>
            </Select>
          </Form.Item>
          <div className="admin-departments-page__modal-footer">
            <Button onClick={handleCancel}>Отмена</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingItem ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </Form>
      </Modal>
    </section>
  );
}
