import { Button, Form, Input, Table, message } from 'antd';
import { useEffect, useState } from 'react';

import {
  createIncidentType,
  fetchIncidentTypes,
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

  const onFinish = async (values: FormValues) => {
    if (!token) {
      message.error('Требуется авторизация');
      return;
    }

    setSubmitting(true);
    try {
      await createIncidentType({ name: values.name.trim() }, { token });
      message.success('Тип инцидента добавлен');
      form.resetFields();
      await loadIncidentTypes();
    } catch {
      message.error('Не удалось добавить тип инцидента');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="admin-incident-types-page">
      <Form form={form} layout="inline" onFinish={onFinish} className="admin-incident-types-page__form">
        <Form.Item name="name" rules={[{ required: true, message: 'Введите название типа' }]}>
          <Input placeholder="Название типа инцидента" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting}>
          Добавить
        </Button>
      </Form>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', key: 'id', width: '15%' },
          { title: 'Название', dataIndex: 'name', key: 'name' },
          {
            title: 'Создано',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (value: string) => formatDateTime(value),
          },
        ]}
      />
    </section>
  );
}
