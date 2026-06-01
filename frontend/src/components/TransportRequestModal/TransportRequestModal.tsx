import { Alert, Button, DatePicker, Form, InputNumber, Modal, Select, TimePicker, Typography, message } from 'antd';
import Input from 'antd/es/input/Input';
import type { Dayjs } from 'dayjs';
import React, { useEffect, useState } from 'react';

import { fetchDepartments } from '../../Core/services/incident.service';
import { createTransportRequest } from '../../Core/services/transport-request.service';
import type { Department } from '../../Core/types/common';
import './TransportRequestModal.scss';

type TransportRequestModalProps = {
  open: boolean;
  onClose: () => void;
};

const formatPhoneMask = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const digitsWithoutCountryCode = digits.startsWith('7') ? digits.slice(1) : digits;
  const phoneDigits = digitsWithoutCountryCode.slice(0, 10);
  if (!phoneDigits) return '+7';
  let formatted = `+7(${phoneDigits.slice(0, 3)}`;
  if (phoneDigits.length >= 3) formatted += ')';
  if (phoneDigits.length > 3) formatted += phoneDigits.slice(3, 6);
  if (phoneDigits.length > 6) formatted += `-${phoneDigits.slice(6, 8)}`;
  if (phoneDigits.length > 8) formatted += `-${phoneDigits.slice(8, 10)}`;
  return formatted;
};

type TransportRequestFormValues = {
  department: string;
  initiator: string;
  position?: string;
  phone?: string;
  submission_date: Dayjs;
  submission_time: Dayjs;
  route_from: string;
  route_to: string;
  purpose: string;
  passenger_count: number;
  special_notes?: string;
};

export function TransportRequestModal({ open, onClose }: TransportRequestModalProps) {
  const [form] = Form.useForm<TransportRequestFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [createdRequestId, setCreatedRequestId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setCreatedRequestId(null);
      form.resetFields();
      return;
    }

    const loadDepartments = async () => {
      try {
        const data = await fetchDepartments();
        setDepartments(data);
      } catch {
        message.error('Не удалось загрузить отделения');
      }
    };

    void loadDepartments();
  }, [form, open]);

  const handleModalClose = () => {
    setCreatedRequestId(null);
    form.resetFields();
    onClose();
  };

  const onFinish = async (values: TransportRequestFormValues) => {
    setSubmitting(true);
    try {
      const created = await createTransportRequest({
        ...values,
        submission_date: values.submission_date.format('YYYY-MM-DD'),
        submission_time: values.submission_time.format('HH:mm'),
        position: values.position,
        phone: values.phone,
        special_notes: values.special_notes || undefined,
      });
      setCreatedRequestId(created.id);
      message.success('Транспортная заявка отправлена');
    } catch {
      message.error('Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Транспортная заявка"
      open={open}
      onCancel={handleModalClose}
      footer={null}
      width={720}
      wrapClassName="transport-request-modal-wrapper"
      destroyOnClose
    >
      {createdRequestId ? (
        <div className="transport-request-modal__success">
          <Alert
            type="success"
            showIcon
            message="Заявка успешно отправлена"
            description={
              <div>
                <Typography.Text>Номер вашей заявки: </Typography.Text>
                <Typography.Text strong>#{createdRequestId}</Typography.Text>
                <br />
                <Typography.Text>Запомните или запишите номер заявки для просмотра статуса.</Typography.Text>
              </div>
            }
          />
          <Button type="primary" onClick={handleModalClose}>
            Закрыть
          </Button>
        </div>
      ) : (
        <Form form={form} layout="vertical" onFinish={onFinish} className="transport-request-modal">
          <div className="transport-request-modal__row">
            <Form.Item
              name="initiator"
              label="Инициатор (ФИО)"
              rules={[{ required: true, message: 'Введите ФИО' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="department"
              label="Отделение"
              rules={[{ required: true, message: 'Выберите отделение' }]}
            >
              <Select options={departments.map((d) => ({ value: d.name, label: d.name }))} />
            </Form.Item>
          </div>

          <div className="transport-request-modal__row">
            <Form.Item
              name="position"
              label="Должность"
              rules={[{ required: true, message: 'Введите должность' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Телефон"
              rules={[{ required: true, message: 'Введите телефон' }]}
              getValueFromEvent={(e: React.ChangeEvent<HTMLInputElement>) =>
                formatPhoneMask(e.target.value)
              }
            >
              <Input placeholder="+7(___)-__-__" />
            </Form.Item>
          </div>

          <div className="transport-request-modal__row">
            <Form.Item
              name="submission_date"
              label="Дата подачи"
              rules={[{ required: true, message: 'Выберите дату' }]}
            >
              <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="submission_time"
              label="Время подачи"
              rules={[{ required: true, message: 'Укажите время' }]}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div className="transport-request-modal__row">
            <Form.Item
              name="route_from"
              label="Откуда забирать"
              rules={[{ required: true, message: 'Укажите место отправления' }]}
            >
              <Input placeholder="Адрес или место отправления" />
            </Form.Item>

            <Form.Item
              name="route_to"
              label="Куда ехать"
              rules={[{ required: true, message: 'Укажите место назначения' }]}
            >
              <Input placeholder="Адрес или место назначения" />
            </Form.Item>
          </div>

          <div className="transport-request-modal__row">
            <Form.Item
              name="purpose"
              label="Цель поездки"
              rules={[{ required: true, message: 'Укажите цель поездки' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="passenger_count"
              label="Количество пассажиров"
              rules={[{ required: true, message: 'Укажите количество' }]}
            >
              <InputNumber min={1} max={50} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item name="special_notes" label="Особые отметки">
            <Input placeholder="Необязательно" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={submitting}>
            Отправить заявку
          </Button>
        </Form>
      )}
    </Modal>
  );
}
