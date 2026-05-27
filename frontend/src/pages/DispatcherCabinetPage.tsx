import { BellOutlined, CarOutlined } from '@ant-design/icons';
import { Button, Input, List, Menu, Modal, Select, Space, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { MaxLinkCard } from '../components/MaxLinkCard/MaxLinkCard';
import { formatDateTime } from '../Core/date.utils';
import {
  fetchTransportRequests,
  updateTransportRequestComment,
  updateTransportRequestStatus,
} from '../Core/services/transport-request.service';
import type { TransportRequestStatus } from '../Core/services/transport-request.service';
import { useAppStore } from '../Core/store/app.store';
import type { TransportRequest } from '../Core/types/common';
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

type Section = 'transport-requests' | 'notifications';

export function DispatcherCabinetPage() {
  const token = useAppStore((state) => state.token);
  const [activeSection, setActiveSection] = useState<Section>('transport-requests');

  const [items, setItems] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TransportRequest | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [filterStatus, setFilterStatus] = useState<TransportRequestStatus | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string | null>(null);

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
    return result;
  }, [items, filterStatus, filterDepartment]);

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
              { key: 'notifications', icon: <BellOutlined />, label: 'Уведомления Max' },
            ]}
          />
        </aside>

        <div className="dispatcher-cabinet-page__content">
          {activeSection === 'notifications' ? (
            <>
              <Typography.Title level={4} className="dispatcher-cabinet-page__title">
                Уведомления Max
              </Typography.Title>
              <MaxLinkCard />
            </>
          ) : (
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
                <Button onClick={() => { setFilterStatus(null); setFilterDepartment(null); }}>
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
                        <span>{item.submission_date} {item.submission_time}</span>
                        <span>{formatDateTime(item.created_at)}</span>
                      </div>
                      <Typography.Paragraph ellipsis={{ rows: 1 }} className="dispatcher-cabinet-page__text">
                        {item.purpose}
                      </Typography.Paragraph>
                    </div>
                    <StatusTag status={item.status} />
                  </List.Item>
                )}
              />
            </>
          )}
        </div>
      </div>

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
            <p><strong>Инициатор:</strong> {selectedItem.initiator}</p>
            <p><strong>Дата/время подачи:</strong> {selectedItem.submission_date} {selectedItem.submission_time}</p>
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
    </section>
  );
}
