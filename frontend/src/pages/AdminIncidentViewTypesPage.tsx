import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import {
  createIncidentViewType,
  deleteIncidentViewType,
  fetchIncidentTypes,
  fetchIncidentViewTypes,
  fetchLinkedIncidentTypes,
  syncIncidentTypesForViewType,
  updateIncidentViewType,
} from '../Core/services/incident.service';
import { formatDateTime } from '../Core/date.utils';
import { useAppStore } from '../Core/store/app.store';
import type { IncidentType, IncidentViewType } from '../Core/types/common';
import './AdminIncidentViewTypesPage.scss';

type FormValues = {
  name: string;
  care_type: string;
  incident_type_ids: number[];
};

export function AdminIncidentViewTypesPage() {
  const [form] = Form.useForm<FormValues>();
  const [items, setItems] = useState<IncidentViewType[]>([]);
  const [allIncidentTypes, setAllIncidentTypes] = useState<IncidentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IncidentViewType | null>(null);
  const [filterName, setFilterName] = useState('');
  const [filterCareType, setFilterCareType] = useState<string | undefined>(undefined);
  const token = useAppStore((state) => state.token);

  const loadItems = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [viewTypes, incidentTypes] = await Promise.all([
        fetchIncidentViewTypes({ token }),
        fetchIncidentTypes(),
      ]);
      setItems(viewTypes);
      setAllIncidentTypes(incidentTypes);
    } catch {
      message.error('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    form.setFieldsValue({ name: '', care_type: undefined, incident_type_ids: [] });
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = async (item: IncidentViewType) => {
    if (!token) return;
    setEditingItem(item);
    setModalOpen(true);
    try {
      const linked = await fetchLinkedIncidentTypes(item.id, { token });
      form.setFieldsValue({
        name: item.name,
        care_type: item.care_type,
        incident_type_ids: linked.map((t) => t.id),
      });
    } catch {
      form.setFieldsValue({ name: item.name, care_type: item.care_type, incident_type_ids: [] });
    }
  };

  const handleCancel = () => {
    setModalOpen(false);
    setEditingItem(null);
    form.resetFields();
  };

  const onFinish = async (values: FormValues) => {
    if (!token) { message.error('Требуется авторизация'); return; }
    setSubmitting(true);
    try {
      let viewTypeId: number;
      if (editingItem) {
        await updateIncidentViewType(
          editingItem.id,
          { name: values.name.trim(), care_type: values.care_type },
          { token },
        );
        viewTypeId = editingItem.id;
        message.success('Вид нежелательного события обновлён');
      } else {
        const created = await createIncidentViewType(
          { name: values.name.trim(), care_type: values.care_type },
          { token },
        );
        viewTypeId = created.id;
        message.success('Вид нежелательного события добавлен');
      }
      await syncIncidentTypesForViewType(viewTypeId, values.incident_type_ids ?? [], { token });
      handleCancel();
      await loadItems();
    } catch {
      message.error(editingItem ? 'Не удалось обновить' : 'Не удалось добавить');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    try {
      await deleteIncidentViewType(id, { token });
      message.success('Вид нежелательного события удалён');
      await loadItems();
    } catch {
      message.error('Не удалось удалить вид нежелательного события');
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
    <section className="admin-incident-view-types-page">
      <div className="admin-incident-view-types-page__toolbar">
        <Space wrap>
          <Input
            placeholder="Поиск по названию"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            allowClear
            style={{ width: 260 }}
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
          { title: 'ID', dataIndex: 'id', key: 'id', width: '7%' },
          { title: 'Название', dataIndex: 'name', key: 'name' },
          {
            title: 'Вид медицинской помощи',
            dataIndex: 'care_type',
            key: 'care_type',
            width: '22%',
          },
          {
            title: 'Типы инцидентов',
            key: 'incident_types',
            render: (_: unknown, record: IncidentViewType) =>
              record.incident_types.length === 0 ? (
                <span style={{ color: '#bbb' }}>—</span>
              ) : (
                <Space size={[4, 4]} wrap>
                  {record.incident_types.map((t) => (
                    <Tag key={t.id}>{t.name}</Tag>
                  ))}
                </Space>
              ),
          },
          {
            title: 'Создано',
            dataIndex: 'created_at',
            key: 'created_at',
            width: '15%',
            render: (value: string) => formatDateTime(value),
          },
          {
            title: '',
            key: 'actions',
            width: '10%',
            render: (_: unknown, record: IncidentViewType) => (
              <Space>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => void openEditModal(record)}
                  title="Изменить"
                />
                <Popconfirm
                  title="Удалить запись?"
                  description="Это действие нельзя отменить."
                  okText="Удалить"
                  cancelText="Отмена"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void handleDelete(record.id)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} title="Удалить" />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingItem ? 'Изменить вид нежелательного события' : 'Добавить вид нежелательного события'}
        open={modalOpen}
        onCancel={handleCancel}
        footer={null}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Название" />
          </Form.Item>
          <Form.Item
            name="care_type"
            label="Вид медицинской помощи"
            rules={[{ required: true, message: 'Выберите вид медицинской помощи' }]}
          >
            <Select placeholder="Выберите вид">
              <Select.Option value="Стационар">Стационар</Select.Option>
              <Select.Option value="Поликлиника">Поликлиника</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="incident_type_ids" label="Типы инцидентов">
            <Select
              mode="multiple"
              placeholder="Выберите типы инцидентов"
              optionFilterProp="children"
              allowClear
            >
              {allIncidentTypes.map((t) => (
                <Select.Option key={t.id} value={t.id}>
                  {t.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <div className="admin-incident-view-types-page__modal-footer">
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
