import { Button, Form, Input, Table, message } from 'antd';
import { useEffect, useState } from 'react';

import {
  createDepartment,
  fetchDepartments,
} from '../Core/services/incident.service';
import { formatDateTime } from '../Core/date.utils';
import { useAppStore } from '../Core/store/app.store';
import type { Department } from '../Core/types/common';
import './AdminDepartmentsPage.scss';

type FormValues = {
  name: string;
};

export function AdminDepartmentsPage() {
  const [form] = Form.useForm<FormValues>();
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const onFinish = async (values: FormValues) => {
    if (!token) {
      message.error('Требуется авторизация');
      return;
    }

    setSubmitting(true);
    try {
      await createDepartment({ name: values.name.trim() }, { token });
      message.success('Отделение добавлено');
      form.resetFields();
      await loadDepartments();
    } catch {
      message.error('Не удалось добавить отделение');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="admin-departments-page">
      <Form form={form} layout="inline" onFinish={onFinish} className="admin-departments-page__form">
        <Form.Item name="name" rules={[{ required: true, message: 'Введите название отделения' }]}>
          <Input placeholder="Название отделения" />
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
