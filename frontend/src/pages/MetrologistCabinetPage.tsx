import { ExperimentOutlined } from '@ant-design/icons';
import { Button, Input, List, Menu, Modal, Select, Space, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { formatDateTime } from '../Core/date.utils';
import {
  fetchMetrologistRequests,
  updateMetrologistRequestComment,
  updateMetrologistRequestStatus,
} from '../Core/services/metrologist-request.service';
import type { MetrologistRequestStatus } from '../Core/services/metrologist-request.service';
import { useAppStore } from '../Core/store/app.store';
import type { MetrologistRequest } from '../Core/types/common';
import './MetrologistCabinetPage.scss';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменена',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'blue',
  in_progress: 'orange',
  done: 'green',
  cancelled: 'red',
};

function StatusTag({ status }: { status: string }) {
  return <Tag color={STATUS_COLORS[status] ?? 'default'}>{STATUS_LABELS[status] ?? status}</Tag>;
}

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as MetrologistRequestStatus[]).map((key) => ({
  value: key,
  label: STATUS_LABELS[key],
}));

export function MetrologistCabinetPage() {
  const token = useAppStore((state) => state.token);
  const [items, setItems] = useState<MetrologistRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MetrologistRequest | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState('');

  const loadRequests = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const data = await fetchMetrologistRequests({ token });
      setItems(data);
    } catch {
      message.error('Не удалось загрузить заявки метрологу');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleStatusChange = async (newStatus: MetrologistRequestStatus) => {
    if (!selectedItem || !token) {
      return;
    }

    setStatusLoading(true);
    try {
      await updateMetrologistRequestStatus(selectedItem.id, newStatus, { token });
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
      await updateMetrologistRequestComment(selectedItem.id, commentText, { token });
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
    <section className="metrologist-cabinet-page">
      <div className="metrologist-cabinet-page__layout">
        <aside className="metrologist-cabinet-page__sidebar">
          <Menu
            mode="inline"
            selectedKeys={['metrologist-requests']}
            items={[
              { key: 'metrologist-requests', icon: <ExperimentOutlined />, label: 'Заявки метрологу' },
            ]}
          />
        </aside>

        <div className="metrologist-cabinet-page__content">
          <Typography.Title level={4} className="metrologist-cabinet-page__title">
            Заявки метрологу
          </Typography.Title>
          <List
            loading={loading}
            dataSource={items}
            locale={{ emptyText: 'Пока нет заявок метрологу' }}
            renderItem={(item) => (
              <List.Item
                className="metrologist-cabinet-page__item"
                onClick={() => {
                  setSelectedItem(item);
                  setCommentText(item.comment ?? '');
                }}
              >
                <div className="metrologist-cabinet-page__main">
                  <div className="metrologist-cabinet-page__request-title">#{item.id} — {item.full_name}</div>
                  <div className="metrologist-cabinet-page__meta">
                    <span>{item.department}</span>
                    <span>Кабинет: {item.location}</span>
                    <span>{formatDateTime(item.created_at)}</span>
                  </div>
                  <Typography.Paragraph ellipsis={{ rows: 2 }} className="metrologist-cabinet-page__text">
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
        title={selectedItem ? `Заявка метрологу #${selectedItem.id}` : 'Заявка метрологу'}
        open={Boolean(selectedItem)}
        onCancel={() => setSelectedItem(null)}
        footer={null}
        destroyOnClose
      >
        {selectedItem ? (
          <div className="metrologist-cabinet-page__details">
            <p><strong>ФИО:</strong> {selectedItem.full_name}</p>
            <p><strong>Телефон:</strong> {selectedItem.phone}</p>
            <p><strong>Отделение:</strong> {selectedItem.department}</p>
            <p><strong>Кабинет:</strong> {selectedItem.location}</p>
            <p>
              <strong>Статус: </strong>
              <Select
                value={selectedItem.status as MetrologistRequestStatus}
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
              <p style={{ marginBottom: 6 }}><strong>Комментарий метролога:</strong></p>
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
        ) : null}
      </Modal>
    </section>
  );
}
