import { Button, DatePicker, Form, Input, Modal, Select, TimePicker, Tooltip, message } from 'antd';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import {
  createIncident,
  fetchDepartments,
  fetchIncidentViewTypesPublic,
  type CreateIncidentPayload,
} from '../../Core/services/incident.service';
import type { Department, IncidentViewType } from '../../Core/types/common';
import './IncidentReportModal.scss';

const SEVERITY_OPTIONS = [
  {
    value: 'light',
    label: 'Лёгкий уровень (минимальное воздействие на здоровье пациента/сотрудника, не требующее дополнительного лечения или госпитализации и не влияющее на продолжительность восстановления)',
  },
  {
    value: 'medium',
    label: 'Средний уровень (временное ухудшение состояния пациента/сотрудника, требующее дополнительного медицинского вмешательства, но не приводящее к длительной инвалидности или угрозе жизни)',
  },
  {
    value: 'severe',
    label: 'Тяжёлый уровень (значительное ухудшение состояния пациента/сотрудника, требующее вмешательства)',
  },
];

type IncidentFormValues = {
  incident_date: Dayjs;
  incident_time: Dayjs;
  care_type: string;
  department_id: number;
  patient_fio: string;
  patient_birth_date: Dayjs;
  incident_view_type_id: number;
  incident_type_id: number;
  circumstances: string;
  legal_presence: string;
  severity_level: string;
  employee_fio: string;
  employee_position: string;
};

type IncidentReportModalProps = {
  open: boolean;
  onClose: () => void;
};

export function IncidentReportModal({ open, onClose }: IncidentReportModalProps) {
  const [form] = Form.useForm<IncidentFormValues>();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [viewTypes, setViewTypes] = useState<IncidentViewType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCareType, setSelectedCareType] = useState<string | null>(null);
  const [selectedViewTypeId, setSelectedViewTypeId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;

    const loadReferences = async () => {
      try {
        const [departmentsData, viewTypesData] = await Promise.all([
          fetchDepartments(),
          fetchIncidentViewTypesPublic(),
        ]);
        setDepartments(departmentsData);
        setViewTypes(viewTypesData);
      } catch {
        message.error('Не удалось загрузить справочники');
      }
    };

    void loadReferences();
  }, [open]);

  const filteredDepartments = useMemo(() => {
    if (!selectedCareType) return [];
    return departments.filter((d) => d.care_type === selectedCareType);
  }, [departments, selectedCareType]);

  const filteredViewTypes = useMemo(() => {
    if (!selectedCareType) return [];
    return viewTypes
      .filter((vt) => vt.care_type === selectedCareType)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }));
  }, [viewTypes, selectedCareType]);

  const linkedIncidentTypes = useMemo(
    () => viewTypes.find((vt) => vt.id === selectedViewTypeId)?.incident_types ?? [],
    [viewTypes, selectedViewTypeId],
  );

  const handleCareTypeChange = (value: string) => {
    setSelectedCareType(value);
    setSelectedViewTypeId(null);
    form.setFieldsValue({
      department_id: undefined,
      incident_view_type_id: undefined,
      incident_type_id: undefined,
    });
  };

  const handleViewTypeChange = (value: number) => {
    setSelectedViewTypeId(value);
    form.setFieldsValue({ incident_type_id: undefined });
  };

  const onFinish = async (values: IncidentFormValues) => {
    setSubmitting(true);
    const payload: CreateIncidentPayload = {
      place: '',
      consequences: '',
      incident_date: values.incident_date.format('YYYY-MM-DD'),
      incident_time: values.incident_time.format('HH:mm'),
      patient_fio: values.patient_fio,
      patient_birth_date: values.patient_birth_date.format('YYYY-MM-DD'),
      circumstances: values.circumstances,
      employee_fio: values.employee_fio,
      employee_position: values.employee_position,
      legal_presence: values.legal_presence,
      department_id: values.department_id,
      incident_view_type_id: values.incident_view_type_id,
      incident_type_id: values.incident_type_id,
      severity_level: values.severity_level,
    };

    try {
      await createIncident(payload);
      message.success('Сообщение об инциденте отправлено');
      form.resetFields();
      setSelectedCareType(null);
      setSelectedViewTypeId(null);
      onClose();
    } catch {
      message.error('Не удалось отправить форму');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setSelectedCareType(null);
    setSelectedViewTypeId(null);
    onClose();
  };

  return (
    <Modal
      title="Сообщить о нежелательном событии"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={900}
      wrapClassName="incident-report-modal-wrapper"
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onFinish} className="incident-report-modal">

        {/* 1. Дата / Время */}
        <div className="incident-report-modal__grid">
          <Form.Item name="incident_date" label="Дата события" rules={[{ required: true, message: 'Укажите дату' }]}>
            <DatePicker className="incident-report-modal__control" format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item name="incident_time" label="Время события" rules={[{ required: true, message: 'Укажите время' }]}>
            <TimePicker className="incident-report-modal__control" format="HH:mm" />
          </Form.Item>
        </div>

        {/* 2–3. Вид медицинской помощи + Отделение */}
        <div className="incident-report-modal__grid">
          <Form.Item
            name="care_type"
            label="Вид медицинской помощи"
            rules={[{ required: true, message: 'Выберите вид медицинской помощи' }]}
          >
            <Select
              placeholder="Выберите вид медицинской помощи"
              onChange={handleCareTypeChange}
              options={[
                { value: 'Стационар', label: 'Стационар' },
                { value: 'Поликлиника', label: 'Поликлиника' },
              ]}
            />
          </Form.Item>

          {selectedCareType ? (
            <Form.Item
              name="department_id"
              label="Отделение"
              rules={[{ required: true, message: 'Выберите отделение' }]}
            >
              <Select
                placeholder="Выберите отделение"
                showSearch
                optionFilterProp="label"
                options={filteredDepartments.map((d) => ({ value: d.id, label: d.name }))}
                notFoundContent="Нет отделений для данного вида помощи"
              />
            </Form.Item>
          ) : <div />}
        </div>

        {/* 4–5. ФИО пациента + Дата рождения */}
        <div className="incident-report-modal__grid">
          <Form.Item
            name="patient_fio"
            label="ФИО пациента"
            rules={[{ required: true, message: 'Укажите ФИО пациента' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="patient_birth_date"
            label="Дата рождения пациента"
            rules={[{ required: true, message: 'Укажите дату рождения' }]}
          >
            <DatePicker className="incident-report-modal__control" format="DD.MM.YYYY" />
          </Form.Item>
        </div>

        {/* 6. Вид нежелательного события (после выбора вида помощи) */}
        {selectedCareType && (
          <Form.Item
            name="incident_view_type_id"
            label="Вид нежелательного события"
            rules={[{ required: true, message: 'Выберите вид нежелательного события' }]}
          >
            <Select
              placeholder="Выберите вид нежелательного события"
              showSearch
              optionFilterProp="label"
              onChange={handleViewTypeChange}
              options={filteredViewTypes.map((vt) => ({ value: vt.id, label: vt.name }))}
              notFoundContent="Нет видов для данного вида помощи"
            />
          </Form.Item>
        )}

        {/* 7. Тип инцидента (после выбора вида нежелательного события) */}
        {selectedViewTypeId !== null && (
          <Form.Item
            name="incident_type_id"
            label="Тип инцидента"
            rules={[{ required: linkedIncidentTypes.length > 0, message: 'Выберите тип инцидента' }]}
          >
            <Select
              placeholder="Выберите тип инцидента"
              showSearch
              optionFilterProp="label"
              options={linkedIncidentTypes.map((t) => ({ value: t.id, label: t.name }))}
              notFoundContent="Нет типов инцидентов для данного вида"
            />
          </Form.Item>
        )}

        {/* 8. Обстоятельства */}
        <Form.Item
          name="circumstances"
          label="Обстоятельства"
          rules={[{ required: true, message: 'Опишите обстоятельства' }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>

        {/* 9–10. Присутствие законного представителя + Уровень тяжести */}
        <div className="incident-report-modal__grid">
          <Form.Item
            name="legal_presence"
            label="Присутствие законного представителя"
            rules={[{ required: true, message: 'Выберите значение' }]}
          >
            <Select
              options={[
                { value: 'YES', label: 'Да' },
                { value: 'NO', label: 'Нет' },
                { value: 'UNKNOWN', label: 'Неизвестно' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="severity_level"
            label="Уровень тяжести"
            rules={[{ required: true, message: 'Выберите уровень тяжести' }]}
          >
            <Select placeholder="Выберите уровень тяжести" optionLabelProp="title">
              {SEVERITY_OPTIONS.map((opt) => {
                const parenIdx = opt.label.indexOf('(');
                const title = opt.label.slice(0, parenIdx).trim();
                const detail = opt.label.slice(parenIdx + 1, -1).trim();
                return (
                  <Select.Option key={opt.value} value={opt.value} title={title}>
                    <Tooltip title={detail} placement="right" mouseEnterDelay={0.3}>
                      <strong style={{ display: 'block' }}>{title}</strong>
                    </Tooltip>
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
        </div>

        {/* 11. ФИО и должность сотрудника */}
        <div className="incident-report-modal__grid">
          <Form.Item
            name="employee_fio"
            label="ФИО сотрудника"
            rules={[{ required: true, message: 'Укажите ФИО сотрудника' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="employee_position"
            label="Должность сотрудника"
            rules={[{ required: true, message: 'Укажите должность' }]}
          >
            <Input />
          </Form.Item>
        </div>

        <Button type="primary" htmlType="submit" loading={submitting} block>
          Отправить
        </Button>
      </Form>
    </Modal>
  );
}
