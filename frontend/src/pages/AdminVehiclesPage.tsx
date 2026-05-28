import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, List, Modal, Popconfirm, Space, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  createVehicle,
  deleteVehicle,
  fetchVehicles,
} from '../Core/services/vehicle.service';
import { useAppStore } from '../Core/store/app.store';
import type { Vehicle } from '../Core/types/common';
import './AdminVehiclesPage.scss';

type VehicleFormValues = {
  make: string;
  model: string;
  license_plate: string;
  driver?: string;
};

export function AdminVehiclesPage() {
  const token = useAppStore((state) => state.token);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<VehicleFormValues>();

  const loadVehicles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchVehicles({ token });
      setVehicles(data);
    } catch {
      message.error('Не удалось загрузить список автомобилей');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  const handleAdd = async (values: VehicleFormValues) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const created = await createVehicle(
        { ...values, driver: values.driver || undefined },
        { token },
      );
      setVehicles((prev) => [...prev, created]);
      form.resetFields();
      setAddOpen(false);
      message.success('Автомобиль добавлен');
    } catch {
      message.error('Не удалось добавить автомобиль');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    try {
      await deleteVehicle(id, { token });
      setVehicles((prev) => prev.filter((v) => v.id !== id));
      message.success('Автомобиль удалён');
    } catch {
      message.error('Не удалось удалить автомобиль');
    }
  };

  return (
    <section className="admin-vehicles-page">
      <div className="admin-vehicles-page__header">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddOpen(true)}
        >
          Добавить автомобиль
        </Button>
      </div>

      <List
        loading={loading}
        dataSource={vehicles}
        locale={{ emptyText: 'Список автомобилей пуст' }}
        renderItem={(vehicle) => (
          <List.Item
            className="admin-vehicles-page__item"
            actions={[
              <Popconfirm
                title="Удалить автомобиль?"
                okText="Да"
                cancelText="Нет"
                onConfirm={() => void handleDelete(vehicle.id)}
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}
          >
            <div className="admin-vehicles-page__main">
              <div className="admin-vehicles-page__title">
                {vehicle.make} {vehicle.model}
              </div>
              <div className="admin-vehicles-page__meta">
                <span>Гос. номер: <strong>{vehicle.license_plate}</strong></span>
                {vehicle.driver && <span>Водитель: {vehicle.driver}</span>}
              </div>
            </div>
          </List.Item>
        )}
      />

      <Modal
        title="Добавить автомобиль"
        open={addOpen}
        onCancel={() => { setAddOpen(false); form.resetFields(); }}
        footer={null}
        destroyOnClose
        width={480}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => void handleAdd(values)}
          style={{ marginTop: 8 }}
        >
          <div className="admin-vehicles-page__form-row">
            <Form.Item
              name="make"
              label="Марка"
              rules={[{ required: true, message: 'Введите марку' }]}
            >
              <Input placeholder="Например: Toyota" />
            </Form.Item>
            <Form.Item
              name="model"
              label="Модель"
              rules={[{ required: true, message: 'Введите модель' }]}
            >
              <Input placeholder="Например: Camry" />
            </Form.Item>
          </div>
          <Form.Item
            name="license_plate"
            label="Гос. номер"
            rules={[{ required: true, message: 'Введите гос. номер' }]}
          >
            <Input placeholder="А 000 АА 102" />
          </Form.Item>
          <Form.Item name="driver" label="Водитель (необязательно)">
            <Input placeholder="ФИО водителя" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Добавить
            </Button>
            <Button onClick={() => { setAddOpen(false); form.resetFields(); }}>
              Отмена
            </Button>
          </Space>
        </Form>
      </Modal>
    </section>
  );
}
