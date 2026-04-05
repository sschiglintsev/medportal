import { EllipsisOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Dropdown, Form, Input, Modal, Select, Space, Table, Upload, message } from 'antd';
import type { MenuProps } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useState } from 'react';

import { formatDateTime } from '../Core/date.utils';
import {
  createDocument,
  deleteDocument,
  fetchDocuments,
  updateDocument,
  type DocumentPayload,
} from '../Core/services/document.service';
import { useAppStore } from '../Core/store/app.store';
import type { PortalDocument } from '../Core/types/common';
import './AdminDocumentsPage.scss';

const categoryOptions = [
  { value: 'Нормативные акты', label: 'Нормативные акты' },
  { value: 'Приказы', label: 'Приказы' },
  { value: 'Инструкции и регламенты', label: 'Инструкции и регламенты' },
  { value: 'Формы и шаблоны', label: 'Формы и шаблоны' },
];

type DocumentFormValues = {
  category: string;
  title: string;
  description?: string;
};

export function AdminDocumentsPage() {
  const [items, setItems] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortalDocument | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const token = useAppStore((state) => state.token);
  const [form] = Form.useForm<DocumentFormValues>();

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await fetchDocuments();
      setItems(data);
    } catch {
      message.error('Не удалось загрузить документы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    form.resetFields();
    setFileList([]);
    setModalOpen(true);
  };

  const openEditModal = (item: PortalDocument) => {
    setEditingItem(item);
    form.setFieldsValue({
      category: item.category,
      title: item.title,
      description: item.description ?? undefined,
    });
    setFileList([]);
    setModalOpen(true);
  };

  const onSubmit = async (values: DocumentFormValues) => {
    if (!token) {
      message.error('Требуется авторизация');
      return;
    }

    const payload: DocumentPayload = {
      category: values.category,
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      file: fileList[0]?.originFileObj,
    };

    if (!editingItem && !payload.file) {
      message.error('Выберите файл документа');
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        await updateDocument(editingItem.id, payload, { token });
        message.success('Документ обновлен');
      } else {
        await createDocument(payload, { token });
        message.success('Документ добавлен');
      }

      setModalOpen(false);
      setEditingItem(null);
      form.resetFields();
      setFileList([]);
      await loadDocuments();
    } catch {
      message.error('Не удалось сохранить документ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: PortalDocument) => {
    if (!token) {
      message.error('Требуется авторизация');
      return;
    }

    Modal.confirm({
      title: 'Удалить документ?',
      content: `Документ "${item.title}" будет удален.`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteDocument(item.id, { token });
          message.success('Документ удален');
          await loadDocuments();
        } catch {
          message.error('Не удалось удалить документ');
        }
      },
    });
  };

  const getActionsMenu = (record: PortalDocument): MenuProps => ({
    items: [
      { key: 'edit', label: 'Редактировать' },
      { key: 'open', label: 'Открыть' },
      { key: 'delete', label: 'Удалить', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'edit') {
        openEditModal(record);
        return;
      }
      if (key === 'open') {
        window.open(`${httpBaseUrl()}${record.file_url}`, '_blank', 'noopener,noreferrer');
        return;
      }
      if (key === 'delete') {
        void handleDelete(record);
      }
    },
  });

  return (
    <section className="admin-documents-page">
      <Space className="admin-documents-page__actions">
        <Button type="primary" icon={<FileTextOutlined />} onClick={openCreateModal}>
          Добавить документ
        </Button>
        <Button onClick={() => void loadDocuments()} loading={loading}>
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
          { title: 'Категория', dataIndex: 'category', key: 'category', width: '18%' },
          { title: 'Название', dataIndex: 'title', key: 'title' },
          { title: 'Описание', dataIndex: 'description', key: 'description', ellipsis: true },
          {
            title: 'Файл',
            dataIndex: 'file_url',
            key: 'file_url',
            width: '12%',
            render: (value: string) => (
              <a href={`${httpBaseUrl()}${value}`} target="_blank" rel="noreferrer">
                Открыть
              </a>
            ),
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
            width: '10%',
            render: (_value: unknown, record: PortalDocument) => (
              <Dropdown menu={getActionsMenu(record)} trigger={['click']}>
                <Button type="text" icon={<EllipsisOutlined />} aria-label="Действия документа" />
              </Dropdown>
            ),
          },
        ]}
      />

      <Modal
        title={editingItem ? 'Редактировать документ' : 'Новый документ'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="category" label="Категория" rules={[{ required: true, message: 'Выберите категорию' }]}>
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            label={editingItem ? 'Файл (опционально заменить)' : 'Файл'}
            required={!editingItem}
          >
            <Upload
              fileList={fileList}
              maxCount={1}
              beforeUpload={() => false}
              onChange={({ fileList: newList }) => setFileList(newList)}
            >
              <Button icon={<UploadOutlined />}>Выбрать файл</Button>
            </Upload>
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={submitting} block>
            {editingItem ? 'Сохранить изменения' : 'Создать'}
          </Button>
        </Form>
      </Modal>
    </section>
  );
}

function httpBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
}
