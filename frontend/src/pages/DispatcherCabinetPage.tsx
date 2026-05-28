import { BellOutlined, CarOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  List,
  Menu,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { MaxLinkCard } from '../components/MaxLinkCard/MaxLinkCard';
import { formatDate, formatDateTime, formatTime } from '../Core/date.utils';
import {
  assignVehicleToRequest,
  fetchTransportRequests,
  updateTransportRequestComment,
  updateTransportRequestStatus,
} from '../Core/services/transport-request.service';
import type { TransportRequestStatus } from '../Core/services/transport-request.service';
import {
  createVehicle,
  deleteVehicle,
  fetchVehicles,
} from '../Core/services/vehicle.service';
import { useAppStore } from '../Core/store/app.store';
import type { TransportRequest, Vehicle } from '../Core/types/common';
import './DispatcherCabinetPage.scss';

const STATUS_LABELS: Record<TransportRequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  cancelled: 'Отменена',
};

const STATUS_COLORS: Record<TransportRequestStatus, string> = {
  new: 'blue',
  in_progress: 'orange',
  done: 'green',
  cancelled: 'red',
};

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as TransportRequestStatus[]).map((key) => ({
  value: key,
  label: STATUS_LABELS[key],
}));

function StatusTag({ status }: { status: string }) {
  const s = status as TransportRequestStatus;
  return <Tag color={STATUS_COLORS[s] ?? 'default'}>{STATUS_LABELS[s] ?? status}</Tag>;
}

type Section = 'transport-requests' | 'vehicles' | 'notifications';

type VehicleFormValues = {
  make: string;
  model: string;
  license_plate: string;
  driver?: string;
};

export function DispatcherCabinetPage() {
  const token = useAppStore((state) => state.token);
  const [activeSection, setActiveSection] = useState<Section>('transport-requests');

  // --- Transport requests state ---
  const [items, setItems] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TransportRequest | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [filterStatus, setFilterStatus] = useState<TransportRequestStatus | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string | null>(null);
  const [filterVehicle, setFilterVehicle] = useState<number | null>(null);

  // --- Vehicles state ---
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [addVehicleSubmitting, setAddVehicleSubmitting] = useState(false);
  const [vehicleAssignLoading, setVehicleAssignLoading] = useState(false);
  const [vehicleForm] = Form.useForm<VehicleFormValues>();

  // --- Load transport requests ---
  const loadRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchTransportRequests({ token });
      setItems(data);
    } catch {
      message.error('Не удалось загрузить транспортные заявки');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  // --- Load vehicles (always, чтобы использовать в модалке заявки) ---
  const loadVehicles = useCallback(async () => {
    if (!token) return;
    setVehiclesLoading(true);
    try {
      const data = await fetchVehicles({ token });
      setVehicles(data);
    } catch {
      message.error('Не удалось загрузить список автомобилей');
    } finally {
      setVehiclesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  // --- Transport requests helpers ---
  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(items.map((it) => it.department).filter(Boolean)))
        .sort()
        .map((d) => ({ value: d, label: d })),
    [items],
  );

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterStatus) result = result.filter((it) => it.status === filterStatus);
    if (filterDepartment) result = result.filter((it) => it.department === filterDepartment);
    if (filterVehicle !== null) result = result.filter((it) => it.vehicle_id === filterVehicle);
    return result;
  }, [items, filterStatus, filterDepartment, filterVehicle]);

  const handleStatusChange = async (newStatus: TransportRequestStatus) => {
    if (!selectedItem || !token) return;
    setStatusLoading(true);
    try {
      await updateTransportRequestStatus(selectedItem.id, newStatus, { token });
      const updated = { ...selectedItem, status: newStatus };
      setSelectedItem(updated);
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      message.success('Статус обновлён');
    } catch {
      message.error('Не удалось обновить статус');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCommentSave = async () => {
    if (!selectedItem || !token) return;
    setCommentLoading(true);
    try {
      await updateTransportRequestComment(selectedItem.id, commentText, { token });
      const updated = { ...selectedItem, comment: commentText || null };
      setSelectedItem(updated);
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      message.success('Комментарий сохранён');
    } catch {
      message.error('Не удалось сохранить комментарий');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleVehicleAssign = async (vehicleId: number | null) => {
    if (!selectedItem || !token) return;
    setVehicleAssignLoading(true);
    try {
      await assignVehicleToRequest(selectedItem.id, vehicleId, { token });
      const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
      const updated: TransportRequest = {
        ...selectedItem,
        vehicle_id: vehicleId,
        vehicle_make: vehicle?.make ?? null,
        vehicle_model: vehicle?.model ?? null,
        vehicle_license_plate: vehicle?.license_plate ?? null,
        vehicle_driver: vehicle?.driver ?? null,
      };
      setSelectedItem(updated);
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      message.success(vehicleId ? 'Автомобиль назначен' : 'Автомобиль снят с заявки');
    } catch {
      message.error('Не удалось обновить автомобиль');
    } finally {
      setVehicleAssignLoading(false);
    }
  };

  // --- Vehicle handlers ---
  const handleAddVehicle = async (values: VehicleFormValues) => {
    if (!token) return;
    setAddVehicleSubmitting(true);
    try {
      const created = await createVehicle(
        { ...values, driver: values.driver || undefined },
        { token },
      );
      setVehicles((prev) => [...prev, created]);
      vehicleForm.resetFields();
      setAddVehicleOpen(false);
      message.success('Автомобиль добавлен');
    } catch {
      message.error('Не удалось добавить автомобиль');
    } finally {
      setAddVehicleSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (id: number) => {
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
    <section className="dispatcher-cabinet-page">
      <div className="dispatcher-cabinet-page__layout">
        <aside className="dispatcher-cabinet-page__sidebar">
          <Menu
            mode="inline"
            selectedKeys={[activeSection]}
            onClick={({ key }) => setActiveSection(key as Section)}
            items={[
              { key: 'transport-requests', icon: <CarOutlined />, label: 'Транспортные заявки' },
              { key: 'vehicles', icon: <CarOutlined />, label: 'Автомобили' },
              { key: 'notifications', icon: <BellOutlined />, label: 'Уведомления Max' },
            ]}
          />
        </aside>

        <div className="dispatcher-cabinet-page__content">
          {/* ── Уведомления Max ── */}
          {activeSection === 'notifications' && (
            <>
              <Typography.Title level={4} className="dispatcher-cabinet-page__title">
                Уведомления Max
              </Typography.Title>
              <MaxLinkCard />
            </>
          )}

          {/* ── Транспортные заявки ── */}
          {activeSection === 'transport-requests' && (
            <>
              <Typography.Title level={4} className="dispatcher-cabinet-page__title">
                Транспортные заявки
              </Typography.Title>

              <Space size={10} wrap className="dispatcher-cabinet-page__filters">
                <Select
                  placeholder="Фильтр по статусу"
                  allowClear
                  value={filterStatus ?? undefined}
                  options={STATUS_OPTIONS}
                  onChange={(val) => setFilterStatus(val ?? null)}
                  style={{ minWidth: 180 }}
                />
                <Select
                  placeholder="Фильтр по отделению"
                  allowClear
                  showSearch
                  value={filterDepartment ?? undefined}
                  options={departmentOptions}
                  onChange={(val) => setFilterDepartment(val ?? null)}
                  style={{ minWidth: 220 }}
                />
                <Select
                  placeholder="Фильтр по автомобилю"
                  allowClear
                  value={filterVehicle ?? undefined}
                  options={vehicles.map((v) => ({
                    value: v.id,
                    label: `${v.make} ${v.model} · ${v.license_plate}`,
                  }))}
                  onChange={(val) => setFilterVehicle(val ?? null)}
                  style={{ minWidth: 220 }}
                />
                <Button onClick={() => { setFilterStatus(null); setFilterDepartment(null); setFilterVehicle(null); }}>
                  Сбросить
                </Button>
                <Button type="primary" onClick={() => void loadRequests()} loading={loading}>
                  Обновить
                </Button>
              </Space>

              <List
                loading={loading}
                dataSource={filteredItems}
                locale={{ emptyText: 'Пока нет транспортных заявок' }}
                renderItem={(item) => (
                  <List.Item
                    className="dispatcher-cabinet-page__item"
                    onClick={() => {
                      setSelectedItem(item);
                      setCommentText(item.comment ?? '');
                    }}
                  >
                    <div className="dispatcher-cabinet-page__main">
                      <div className="dispatcher-cabinet-page__request-title">
                        #{item.id} — {item.initiator}
                      </div>
                      <div className="dispatcher-cabinet-page__meta">
                        <span>{item.department}</span>
                        <span>{item.route_from} → {item.route_to}</span>
                        {item.vehicle_make && (
                          <span>🚗 {item.vehicle_make} {item.vehicle_model} · {item.vehicle_license_plate}</span>
                        )}
                      </div>
                      <div className="dispatcher-cabinet-page__meta dispatcher-cabinet-page__meta--dates">
                        <span>Создана: {formatDateTime(item.created_at)}</span>
                        <span>Дата и время подачи: {formatDate(item.submission_date)} {formatTime(item.submission_time)}</span>
                      </div>
                      <Typography.Paragraph ellipsis={{ rows: 1 }} className="dispatcher-cabinet-page__text">
                        Цель: {item.purpose}
                      </Typography.Paragraph>
                    </div>
                    <StatusTag status={item.status} />
                  </List.Item>
                )}
              />
            </>
          )}

          {/* ── Автомобили ── */}
          {activeSection === 'vehicles' && (
            <>
              <div className="dispatcher-cabinet-page__section-header">
                <Typography.Title level={4} className="dispatcher-cabinet-page__title">
                  Автомобили
                </Typography.Title>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setAddVehicleOpen(true)}
                >
                  Добавить
                </Button>
              </div>

              <List
                loading={vehiclesLoading}
                dataSource={vehicles}
                locale={{ emptyText: 'Список автомобилей пуст' }}
                renderItem={(vehicle) => (
                  <List.Item
                    className="dispatcher-cabinet-page__item dispatcher-cabinet-page__item--vehicle"
                    actions={[
                      <Popconfirm
                        title="Удалить автомобиль?"
                        okText="Да"
                        cancelText="Нет"
                        onConfirm={() => void handleDeleteVehicle(vehicle.id)}
                      >
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>,
                    ]}
                  >
                    <div className="dispatcher-cabinet-page__main">
                      <div className="dispatcher-cabinet-page__request-title">
                        {vehicle.make} {vehicle.model}
                      </div>
                      <div className="dispatcher-cabinet-page__meta">
                        <span>Гос. номер: <strong>{vehicle.license_plate}</strong></span>
                        {vehicle.driver && <span>Водитель: {vehicle.driver}</span>}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Модальное окно: детали заявки ── */}
      <Modal
        title={selectedItem ? `Транспортная заявка #${selectedItem.id}` : 'Транспортная заявка'}
        open={Boolean(selectedItem)}
        onCancel={() => setSelectedItem(null)}
        footer={null}
        destroyOnClose
        width={600}
      >
        {selectedItem && (
          <div className="dispatcher-cabinet-page__details">
            <p><strong>Отделение:</strong> {selectedItem.department}</p>
            <p><strong>Инициатор:</strong> {selectedItem.initiator}{selectedItem.position ? `, ${selectedItem.position}` : ''}</p>
            {selectedItem.phone && <p><strong>Телефон:</strong> {selectedItem.phone}</p>}
            <p><strong>Дата/время подачи:</strong> {formatDate(selectedItem.submission_date)} {formatTime(selectedItem.submission_time)}</p>
            <p><strong>Маршрут:</strong> {selectedItem.route_from} → {selectedItem.route_to}</p>
            <p><strong>Цель поездки:</strong> {selectedItem.purpose}</p>
            <p><strong>Пассажиров:</strong> {selectedItem.passenger_count}</p>
            {selectedItem.special_notes && (
              <p><strong>Особые отметки:</strong> {selectedItem.special_notes}</p>
            )}
            <p>
              <strong>Статус: </strong>
              <Select
                value={selectedItem.status as TransportRequestStatus}
                options={STATUS_OPTIONS}
                onChange={(value) => void handleStatusChange(value)}
                loading={statusLoading}
                style={{ minWidth: 150 }}
                size="small"
              />
            </p>
            <p>
              <strong>Автомобиль: </strong>
              <Select
                value={selectedItem.vehicle_id ?? undefined}
                allowClear
                placeholder="Выбрать автомобиль"
                loading={vehicleAssignLoading}
                onChange={(val) => void handleVehicleAssign(val ?? null)}
                style={{ minWidth: 240 }}
                size="small"
                options={vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.make} ${v.model} · ${v.license_plate}${v.driver ? ` (${v.driver})` : ''}`,
                }))}
              />
            </p>
            <p><strong>Создано:</strong> {formatDateTime(selectedItem.created_at)}</p>

            <div className="dispatcher-cabinet-page__comment-block">
              <p><strong>Комментарий диспетчера:</strong></p>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input.TextArea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Введите комментарий..."
                />
                <Button
                  type="primary"
                  size="small"
                  loading={commentLoading}
                  onClick={() => void handleCommentSave()}
                >
                  Сохранить комментарий
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Модальное окно: добавление автомобиля ── */}
      <Modal
        title="Добавить автомобиль"
        open={addVehicleOpen}
        onCancel={() => { setAddVehicleOpen(false); vehicleForm.resetFields(); }}
        footer={null}
        destroyOnClose
        width={480}
      >
        <Form
          form={vehicleForm}
          layout="vertical"
          onFinish={(values) => void handleAddVehicle(values)}
          style={{ marginTop: 8 }}
        >
          <div className="dispatcher-cabinet-page__vehicle-row">
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
            <Input placeholder="А 000 АА 102" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="driver" label="Водитель (необязательно)">
            <Input placeholder="ФИО водителя" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={addVehicleSubmitting}>
            Добавить
          </Button>
        </Form>
      </Modal>
    </section>
  );
}
