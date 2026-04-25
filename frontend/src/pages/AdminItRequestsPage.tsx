import { Button, Input, List, Modal, Select, Space, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatDateTime } from '../Core/date.utils';
import { fetchItRequests, updateItRequestComment, updateItRequestStatus } from '../Core/services/it-request.service';
import type { ItRequestStatus } from '../Core/services/it-request.service';
import { useAppStore } from '../Core/store/app.store';
import type { ItRequest } from '../Core/types/common';
import './AdminItRequestsPage.scss';

const STATUS_LABELS: Record<ItRequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменена',
};

const STATUS_COLORS: Record<ItRequestStatus, string> = {
  new: 'blue',
  in_progress: 'orange',
  done: 'green',
  cancelled: 'red',
};

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as ItRequestStatus[]).map((key) => ({
  value: key,
  label: STATUS_LABELS[key],
}));

function StatusTag({ status }: { status: string }) {
  const s = status as ItRequestStatus;
  return (
    <Tag color={STATUS_COLORS[s] ?? 'default'}>
      {STATUS_LABELS[s] ?? status}
    </Tag>
  );
}

export function AdminItRequestsPage() {
  const [items, setItems] = useState<ItRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<ItRequestStatus | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const token = useAppStore((state) => state.token);
  const permissions = useAppStore((state) => state.user?.permissions);

  const canChangeStatus =
    permissions?.canManageItRequests === true || permissions?.canAccessAdminCabinet === true;
  const canEditComment =
    permissions?.canManageItRequests === true || permissions?.canAccessAdminCabinet === true;

  const loadRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchItRequests({ token });
      setItems(data);
    } catch {
      message.error('Не удалось загрузить заявки в ИТ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filteredItems = useMemo(
    () => (filterStatus ? items.filter((it) => it.status === filterStatus) : items),
    [items, filterStatus],
  );

  const handleCommentSave = async () => {
    if (!selectedItem || !token) return;
    setCommentLoading(true);
    try {
      await updateItRequestComment(selectedItem.id, commentText, { token });
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

  const handleStatusChange = async (newStatus: ItRequestStatus) => {
    if (!selectedItem || !token) return;
    setStatusLoading(true);
    try {
      await updateItRequestStatus(selectedItem.id, newStatus, { token });
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

  return (
    <section className="admin-it-requests-page">
      <Space size={10} wrap className="admin-it-requests-page__filters">
        <Select
          placeholder="Фильтр по статусу"
          allowClear
          value={filterStatus ?? undefined}
          options={STATUS_OPTIONS}
          onChange={(val) => setFilterStatus(val ?? null)}
          style={{ minWidth: 180 }}
        />
        <Button onClick={() => setFilterStatus(null)}>Сбросить</Button>
        <Button type="primary" onClick={() => void loadRequests()} loading={loading}>
          Обновить
        </Button>
      </Space>

      <List
        loading={loading}
        dataSource={filteredItems}
        locale={{ emptyText: 'Пока нет заявок в ИТ' }}
        renderItem={(item) => (
          <List.Item className="admin-it-requests-page__item" onClick={() => { setSelectedItem(item); setCommentText(item.comment ?? ''); }}>
            <div className="admin-it-requests-page__main">
              <div className="admin-it-requests-page__title">#{item.id} — {item.full_name}</div>
              <div className="admin-it-requests-page__meta">
                <span>{item.department}</span>
                <span>Кабинет: {item.location}</span>
                <span>{formatDateTime(item.created_at)}</span>
              </div>
              <Typography.Paragraph ellipsis={{ rows: 2 }} className="admin-it-requests-page__text">
                {item.request_text}
              </Typography.Paragraph>
            </div>
            <StatusTag status={item.status} />
          </List.Item>
        )}
      />

      <Modal
        title={selectedItem ? `Заявка в ИТ #${selectedItem.id}` : 'Заявка в ИТ'}
        open={Boolean(selectedItem)}
        onCancel={() => setSelectedItem(null)}
        footer={null}
        destroyOnClose
      >
        {selectedItem ? (
          <div className="admin-it-requests-page__details">
            <p><strong>ФИО:</strong> {selectedItem.full_name}</p>
            <p><strong>Телефон:</strong> {selectedItem.phone}</p>
            <p><strong>Отделение:</strong> {selectedItem.department}</p>
            <p><strong>Кабинет:</strong> {selectedItem.location}</p>
            <p>
              <strong>Статус: </strong>
              {canChangeStatus ? (
                <Select
                  value={selectedItem.status as ItRequestStatus}
                  options={STATUS_OPTIONS}
                  onChange={(val) => void handleStatusChange(val)}
                  loading={statusLoading}
                  style={{ minWidth: 140 }}
                  size="small"
                />
              ) : (
                <StatusTag status={selectedItem.status} />
              )}
            </p>
            <p><strong>Создано:</strong> {formatDateTime(selectedItem.created_at)}</p>
            <p><strong>Описание:</strong></p>
            <Typography.Paragraph>{selectedItem.request_text}</Typography.Paragraph>
            <div style={{ marginTop: 12 }}>
              <p style={{ marginBottom: 6 }}><strong>Комментарий ИТ отдела:</strong></p>
              {canEditComment ? (
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
              ) : (
                <Typography.Paragraph style={{ color: selectedItem.comment ? undefined : '#aaa' }}>
                  {selectedItem.comment ?? 'Комментариев нет'}
                </Typography.Paragraph>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
