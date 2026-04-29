import { HomeOutlined } from '@ant-design/icons';
import { Button, Input, List, Menu, Modal, Select, Space, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { formatDateTime } from '../Core/date.utils';
import {
  fetchAhchRequests,
  updateAhchRequestComment,
  updateAhchRequestStatus,
} from '../Core/services/ahch-request.service';
import type { AhchRequestStatus } from '../Core/services/ahch-request.service';
import { useAppStore } from '../Core/store/app.store';
import type { AhchRequest } from '../Core/types/common';
import './FacilityCabinetPage.scss';

const STATUS_LABELS: Record<AhchRequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменена',
};

const STATUS_COLORS: Record<AhchRequestStatus, string> = {
  new: 'blue',
  in_progress: 'orange',
  done: 'green',
  cancelled: 'red',
};

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as AhchRequestStatus[]).map((key) => ({
  value: key,
  label: STATUS_LABELS[key],
}));

function StatusTag({ status }: { status: string }) {
  const typedStatus = status as AhchRequestStatus;
  return <Tag color={STATUS_COLORS[typedStatus] ?? 'default'}>{STATUS_LABELS[typedStatus] ?? status}</Tag>;
}

export function FacilityCabinetPage() {
  const token = useAppStore((state) => state.token);
  const [items, setItems] = useState<AhchRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AhchRequest | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState('');

  const loadRequests = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAhchRequests({ token });
      setItems(data);
    } catch {
      message.error('Не удалось загрузить заявки в АХЧ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleStatusChange = async (newStatus: AhchRequestStatus) => {
    if (!selectedItem || !token) {
      return;
    }
    setStatusLoading(true);
    try {
      await updateAhchRequestStatus(selectedItem.id, newStatus, { token });
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
    if (!selectedItem || !token) {
      return;
    }
    setCommentLoading(true);
    try {
      await updateAhchRequestComment(selectedItem.id, commentText, { token });
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
    <section className="facility-cabinet-page">
      <div className="facility-cabinet-page__layout">
        <aside className="facility-cabinet-page__sidebar">
          <Menu
            mode="inline"
            selectedKeys={['ahch-requests']}
            items={[{ key: 'ahch-requests', icon: <HomeOutlined />, label: 'Заявки в АХЧ' }]}
          />
        </aside>

        <div className="facility-cabinet-page__content">
          <Typography.Title level={4} className="facility-cabinet-page__title">
            Заявки в АХЧ
          </Typography.Title>
          <List
            loading={loading}
            dataSource={items}
            locale={{ emptyText: 'Пока нет заявок в АХЧ' }}
            renderItem={(item) => (
              <List.Item
                className="facility-cabinet-page__item"
                onClick={() => {
                  setSelectedItem(item);
                  setCommentText(item.comment ?? '');
                }}
              >
                <div className="facility-cabinet-page__main">
                  <div className="facility-cabinet-page__request-title">#{item.id} — {item.address}</div>
                  <div className="facility-cabinet-page__meta">
                    <span>{item.department}</span>
                    <span>Телефон: {item.employee_phone}</span>
                    <span>{formatDateTime(item.created_at)}</span>
                  </div>
                  <Typography.Paragraph ellipsis={{ rows: 2 }} className="facility-cabinet-page__text">
                    {item.request_text}
                  </Typography.Paragraph>
                </div>
                <StatusTag status={item.status} />
              </List.Item>
            )}
          />
        </div>
      </div>

      <Modal
        title={selectedItem ? `Заявка в АХЧ #${selectedItem.id}` : 'Заявка в АХЧ'}
        open={Boolean(selectedItem)}
        onCancel={() => setSelectedItem(null)}
        footer={null}
        destroyOnClose
      >
        {selectedItem ? (
          <div className="facility-cabinet-page__details">
            <p><strong>Адрес:</strong> {selectedItem.address}</p>
            <p><strong>Отделение:</strong> {selectedItem.department}</p>
            <p><strong>Телефон сотрудника:</strong> {selectedItem.employee_phone}</p>
            <p>
              <strong>Статус: </strong>
              <Select
                value={selectedItem.status as AhchRequestStatus}
                options={STATUS_OPTIONS}
                onChange={(value) => void handleStatusChange(value)}
                loading={statusLoading}
                style={{ minWidth: 140 }}
                size="small"
              />
            </p>
            <p><strong>Создано:</strong> {formatDateTime(selectedItem.created_at)}</p>
            <p><strong>Описание:</strong></p>
            <Typography.Paragraph>{selectedItem.request_text}</Typography.Paragraph>
            <div style={{ marginTop: 12 }}>
              <p style={{ marginBottom: 6 }}><strong>Комментарий АХЧ:</strong></p>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input.TextArea
                  rows={3}
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
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
        ) : null}
      </Modal>
    </section>
  );
}
