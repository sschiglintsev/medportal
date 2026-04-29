import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Button, DatePicker, Form, Input, Modal, Popconfirm, Space, Table, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';

import { formatDate, formatDateTime } from '../Core/date.utils';
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  updateAnnouncement,
} from '../Core/services/announcement.service';
import { useAppStore } from '../Core/store/app.store';
import type { Announcement } from '../Core/types/common';
import './AdminAnnouncementsPage.scss';

type AnnouncementFormValues = {
  title: string;
  description: string;
  full_description: string;
  image_url?: string;
  published_date: Dayjs;
};

export function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const token = useAppStore((state) => state.token);
  const [form] = Form.useForm<AnnouncementFormValues>();

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await fetchAnnouncements();
      setItems(data);
    } catch {
      message.error('Не удалось загрузить объявления');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (item: Announcement) => {
    setEditingItem(item);
    form.setFieldsValue({
      title: item.title,
      description: item.description,
      full_description: item.full_description,
      image_url: item.image_url ?? undefined,
      published_date: dayjs(item.published_date),
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: AnnouncementFormValues) => {
    if (!token) {
      message.error('Требуется авторизация');
      return;
    }

    setSubmitting(true);
    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      full_description: values.full_description.trim(),
      image_url: values.image_url?.trim() || undefined,
      published_date: values.published_date.format('YYYY-MM-DD'),
    };

    try {
      if (editingItem) {
        await updateAnnouncement(editingItem.id, payload, { token });
        message.success('Объявление обновлено');
      } else {
        await createAnnouncement(payload, { token });
        message.success('Объявление добавлено');
      }

      setModalOpen(false);
      setEditingItem(null);
      form.resetFields();
      await loadAnnouncements();
    } catch {
      message.error('Не удалось сохранить объявление');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) {
      message.error('Требуется авторизация');
      return;
    }

    setDeletingId(id);
    try {
      await deleteAnnouncement(id, { token });
      message.success('Объявление удалено');
      await loadAnnouncements();
    } catch {
      message.error('Не удалось удалить объявление');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="admin-announcements-page">
      <Space className="admin-announcements-page__actions">
        <Button type="primary" onClick={openCreateModal}>
          Добавить объявление
        </Button>
        <Button onClick={() => void loadAnnouncements()} loading={loading}>
          Обновить
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: 'ID', dataIndex: 'id', key: 'id', width: '8%' },
          {
            title: 'Дата публикации',
            dataIndex: 'published_date',
            key: 'published_date',
            width: '16%',
            render: (value: string) => formatDate(value),
          },
          { title: 'Заголовок', dataIndex: 'title', key: 'title' },
          {
            title: 'Полное описание',
            dataIndex: 'full_description',
            key: 'full_description',
            ellipsis: true,
          },
          {
            title: 'Создано',
            dataIndex: 'created_at',
            key: 'created_at',
            width: '16%',
            render: (value: string) => formatDateTime(value),
          },
          {
            title: 'Действия',
            key: 'actions',
            width: 110,
            render: (_value: unknown, record: Announcement) => (
              <div className="admin-announcements-page__table-actions">
                <Tooltip title="Редактировать">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(record)}
                  />
                </Tooltip>
                <Popconfirm
                  title="Удалить объявление?"
                  description="Это действие нельзя отменить."
                  okText="Удалить"
                  cancelText="Отмена"
                  onConfirm={() => void handleDelete(record.id)}
                >
                  <Tooltip title="Удалить">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      loading={deletingId === record.id}
                    />
                  </Tooltip>
                </Popconfirm>
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={editingItem ? 'Редактировать объявление' : 'Новое объявление'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="title" label="Заголовок" rules={[{ required: true, message: 'Введите заголовок' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="Краткое описание"
            rules={[{ required: true, message: 'Введите описание' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            name="full_description"
            label="Полное описание"
            rules={[{ required: true, message: 'Введите полное описание' }]}
          >
            <Input.TextArea rows={6} />
          </Form.Item>
          <Form.Item name="image_url" label="Ссылка на изображение (URL)">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item
            name="published_date"
            label="Дата публикации"
            rules={[{ required: true, message: 'Выберите дату публикации' }]}
          >
            <DatePicker format="DD.MM.YYYY" className="admin-announcements-page__date" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={submitting} block>
            {editingItem ? 'Сохранить изменения' : 'Создать'}
          </Button>
        </Form>
      </Modal>
    </section>
  );
}
