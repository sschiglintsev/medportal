import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Popconfirm, Space, Table, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import {
  createIncidentType,
  deleteIncidentType,
  fetchIncidentTypes,
  updateIncidentType,
} from '../Core/services/incident.service';
import { formatDateTime } from '../Core/date.utils';
import { useAppStore } from '../Core/store/app.store';
import type { IncidentType } from '../Core/types/common';
import './AdminIncidentTypesPage.scss';

type FormValues = {
  name: string;
};

export function AdminIncidentTypesPage() {
  const [form] = Form.useForm<FormValues>();
  const [items, setItems] = useState<IncidentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IncidentType | null>(null);
  const [filterName, setFilterName] = useState('');
  const token = useAppStore((state) => state.token);

  const loadIncidentTypes = async () => {
    setLoading(true);
    try {
      const data = await fetchIncidentTypes();
      setItems(data);
    } catch {
      message.error('Не удалось загрузить типы инцидентов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIncidentTypes();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (item: IncidentType) => {
    setEditingItem(item);
    form.setFieldsValue({ name: item.name });
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
        await updateIncidentType(editingItem.id, { name: values.name.trim() }, { token });
        message.success('Тип инцидента обновлён');
      } else {
        await createIncidentType({ name: values.name.trim() }, { token });
        message.success('Тип инцидента добавлен');
      }
      handleCancel();
      await loadIncidentTypes();
    } catch {
      message.error(editingItem ? 'Не удалось обновить тип инцидента' : 'Не удалось добавить тип инцидента');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    try {
      await deleteIncidentType(id, { token });
      message.success('Тип инцидента удалён');
      await loadIncidentTypes();
    } catch {
      message.error('Не удалось удалить тип инцидента. Возможно, он используется в событиях.');
    }
  };

  const filtered = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(filterName.toLowerCase())),
    [items, filterName],
  );

  return (
    <section className="admin-incident-types-page">
      <div className="admin-incident-types-page__toolbar">
        <Input
          placeholder="Поиск по названию"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
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
          { title: 'ID', dataIndex: 'id', key: 'id', width: '10%' },
          { title: 'Название', dataIndex: 'name', key: 'name' },
          {
            title: 'Создано',
            dataIndex: 'created_at',
            key: 'created_at',
            width: '22%',
            render: (value: string) => formatDateTime(value),
          },
          {
            title: '',
            key: 'actions',
            width: '12%',
            render: (_: unknown, record: IncidentType) => (
              <Space>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEditModal(record)}
                />
                <Popconfirm
                  title="Удалить тип инцидента?"
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
        title={editingItem ? 'Изменить тип инцидента' : 'Добавить тип инцидента'}
        open={modalOpen}
        onCancel={handleCancel}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: 'Введите название типа' }]}
          >
            <Input placeholder="Название типа инцидента" />
          </Form.Item>
          <div className="admin-incident-types-page__modal-footer">
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
