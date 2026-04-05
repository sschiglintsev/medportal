import { Button, DatePicker, Form, Input, Select, TimePicker, Typography, message } from 'antd';
import type { Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';

import {
  createIncident,
  fetchDepartments,
  fetchIncidentTypes,
  type CreateIncidentPayload,
} from '../Core/services/incident.service';
import type { Department, IncidentType } from '../Core/types/common';
import './IncidentFormPage.scss';

type IncidentFormValues = {
  incident_date: Dayjs;
  incident_time: Dayjs;
  place: string;
  patient_fio: string;
  patient_birth_date: Dayjs;
  circumstances: string;
  employee_fio: string;
  employee_position: string;
  legal_presence: string;
  department_id: number;
  incident_type_id: number;
  consequences: string;
};

export function IncidentFormPage() {
  const [form] = Form.useForm<IncidentFormValues>();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadReferences = async () => {
      try {
        const [departmentsData, incidentTypesData] = await Promise.all([
          fetchDepartments(),
          fetchIncidentTypes(),
        ]);
        setDepartments(departmentsData);
        setIncidentTypes(incidentTypesData);
      } catch {
        message.error('Не удалось загрузить справочники');
      }
    };

    void loadReferences();
  }, []);

  const onFinish = async (values: IncidentFormValues) => {
    setLoading(true);

    const payload: CreateIncidentPayload = {
      ...values,
      incident_date: values.incident_date.format('YYYY-MM-DD'),
      incident_time: values.incident_time.format('HH:mm'),
      patient_birth_date: values.patient_birth_date.format('YYYY-MM-DD'),
    };

    try {
      await createIncident(payload);
      message.success('Инцидент успешно отправлен');
      form.resetFields();
    } catch {
      message.error('Не удалось отправить инцидент');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="incident-form-page">
      <Typography.Title level={3}>Форма нежелательного события</Typography.Title>

      <Form form={form} layout="vertical" onFinish={onFinish} className="incident-form-page__form">
        <div className="incident-form-page__grid">
          <Form.Item name="incident_date" label="Дата события" rules={[{ required: true }]}>
            <DatePicker className="incident-form-page__control" format="DD.MM.YYYY" />
          </Form.Item>

          <Form.Item name="incident_time" label="Время события" rules={[{ required: true }]}>
            <TimePicker className="incident-form-page__control" format="HH:mm" />
          </Form.Item>
        </div>

        <Form.Item name="place" label="Место" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item name="patient_fio" label="ФИО пациента" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item name="patient_birth_date" label="Дата рождения пациента" rules={[{ required: true }]}>
          <DatePicker className="incident-form-page__control" format="DD.MM.YYYY" />
        </Form.Item>

        <Form.Item name="circumstances" label="Обстоятельства" rules={[{ required: true }]}>
          <Input.TextArea rows={4} />
        </Form.Item>

        <Form.Item name="employee_fio" label="ФИО сотрудника" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item name="employee_position" label="Должность сотрудника" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item name="legal_presence" label="Присутствие законного представителя" rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'YES', label: 'Да' },
              { value: 'NO', label: 'Нет' },
              { value: 'UNKNOWN', label: 'Неизвестно' },
            ]}
          />
        </Form.Item>

        <div className="incident-form-page__grid">
          <Form.Item name="department_id" label="Отделение" rules={[{ required: true }]}>
            <Select
              options={departments.map((department) => ({
                value: department.id,
                label: department.name,
              }))}
            />
          </Form.Item>

          <Form.Item name="incident_type_id" label="Вид нежелательного события" rules={[{ required: true }]}>
            <Select
              options={incidentTypes.map((incidentType) => ({
                value: incidentType.id,
                label: incidentType.name,
              }))}
            />
          </Form.Item>
        </div>

        <Form.Item name="consequences" label="Последствия" rules={[{ required: true }]}>
          <Input.TextArea rows={4} />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={loading} className="incident-form-page__submit">
          Отправить
        </Button>
      </Form>
    </section>
  );
}
