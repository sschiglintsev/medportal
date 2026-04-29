import { Alert, Button, Form, Input, Modal, Select, Typography, message } from 'antd';
import { useEffect, useState } from 'react';

import { createAhchRequest } from '../../Core/services/ahch-request.service';
import { fetchDepartments } from '../../Core/services/incident.service';
import type { Department } from '../../Core/types/common';
import './AhchRequestModal.scss';

type AhchRequestModalProps = {
  open: boolean;
  onClose: () => void;
};

type AhchRequestFormValues = {
  address: string;
  department: string;
  request_text: string;
  employee_phone: string;
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

export function AhchRequestModal({ open, onClose }: AhchRequestModalProps) {
  const [form] = Form.useForm<AhchRequestFormValues>();
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

  const onFinish = async (values: AhchRequestFormValues) => {
    setSubmitting(true);
    try {
      const createdRequest = await createAhchRequest(values);
      setCreatedRequestId(createdRequest.id);
      message.success('Заявка в АХЧ отправлена');
    } catch {
      message.error('Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Заявка в АХЧ"
      open={open}
      onCancel={handleModalClose}
      footer={null}
      width={700}
      wrapClassName="ahch-request-modal-wrapper"
      destroyOnClose
    >
      {createdRequestId ? (
        <div className="ahch-request-modal__success">
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
        <Form form={form} layout="vertical" onFinish={onFinish} className="ahch-request-modal">
          <Form.Item name="address" label="Адрес" rules={[{ required: true, message: 'Введите адрес' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="department"
            label="Отделение"
            rules={[{ required: true, message: 'Выберите отделение' }]}
          >
            <Select options={departments.map((item) => ({ value: item.name, label: item.name }))} />
          </Form.Item>
          <Form.Item
            name="request_text"
            label="Описание заявки"
            rules={[{ required: true, message: 'Опишите заявку' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            name="employee_phone"
            label="Телефон сотрудника"
            rules={[{ required: true, message: 'Введите телефон' }]}
            getValueFromEvent={(event) => formatPhoneMask(event.target.value)}
          >
            <Input placeholder="+7(___)___-__-__" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={submitting}>
            Отправить заявку
          </Button>
        </Form>
      )}
    </Modal>
  );
}
