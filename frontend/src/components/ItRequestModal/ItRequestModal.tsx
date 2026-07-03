import { Alert, Button, Form, Input, Modal, Select, Typography, message } from 'antd';
import { useEffect, useState } from 'react';

import { fetchDepartments } from '../../Core/services/incident.service';
import { createItRequest } from '../../Core/services/it-request.service';
import type { Department } from '../../Core/types/common';
import './ItRequestModal.scss';

type ItRequestModalProps = {
  open: boolean;
  onClose: () => void;
};

type ItRequestFormValues = {
  full_name: string;
  phone: string;
  department: string;
  location: string;
  request_text: string;
  remote_access_id?: string;
};

const formatPhoneMask = (value: string): string => {
  const numericValue = value.replace(/\D/g, '');
  const digitsWithoutCountryCode =
    numericValue.startsWith('7') || numericValue.startsWith('8') ? numericValue.slice(1) : numericValue;
  const phoneDigits = digitsWithoutCountryCode.slice(0, 10);

  if (!phoneDigits) {
    return '+7';
  }

  let formattedPhone = '+7';
  formattedPhone += `(${phoneDigits.slice(0, 3)}`;

  if (phoneDigits.length >= 3) {
    formattedPhone += ')';
  }
  if (phoneDigits.length > 3) {
    formattedPhone += phoneDigits.slice(3, 6);
  }
  if (phoneDigits.length > 6) {
    formattedPhone += `-${phoneDigits.slice(6, 8)}`;
  }
  if (phoneDigits.length > 8) {
    formattedPhone += `-${phoneDigits.slice(8, 10)}`;
  }

  return formattedPhone;
};

export function ItRequestModal({ open, onClose }: ItRequestModalProps) {
  const [form] = Form.useForm<ItRequestFormValues>();
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

  const onFinish = async (values: ItRequestFormValues) => {
    setSubmitting(true);
    try {
      const createdRequest = await createItRequest(values);
      setCreatedRequestId(createdRequest.id);
      message.success('Заявка в ИТ отправлена');
    } catch {
      message.error('Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Заявка в отдел ИТ"
      open={open}
      onCancel={handleModalClose}
      footer={null}
      width={700}
      wrapClassName="it-request-modal-wrapper"
      destroyOnClose
    >
      {createdRequestId ? (
        <div className="it-request-modal__success">
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
        <Form form={form} layout="vertical" onFinish={onFinish} className="it-request-modal">
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true, message: 'Введите ФИО' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Телефон"
            rules={[{ required: true, message: 'Введите телефон' }]}
            getValueFromEvent={(event) => formatPhoneMask(event.target.value)}
          >
            <Input placeholder="+7(___)___-__-__" />
          </Form.Item>
          <Form.Item
            name="department"
            label="Отделение"
            rules={[{ required: true, message: 'Выберите отделение' }]}
          >
            <Select options={departments.map((item) => ({ value: item.name, label: item.name }))} />
          </Form.Item>
          <Form.Item
            name="location"
            label="Кабинет (номер)"
            rules={[{ required: true, message: 'Введите номер кабинета' }]}
          >
            <Input placeholder="Например: 214" />
          </Form.Item>
          <Form.Item
            name="request_text"
            label="Описание проблемы"
            rules={[{ required: true, message: 'Опишите проблему' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            name="remote_access_id"
            label="Удаленный доступ (рудеск / ассистент)"
          >
            <Input placeholder="Введите ID" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={submitting}>
            Отправить заявку
          </Button>
        </Form>
      )}
    </Modal>
  );
}
