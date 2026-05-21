import { Alert, Button, Card, Input, Space, Switch, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';

import {
  fetchMaxLinkStatus,
  startMaxLink,
  toggleMaxNotifications,
  unlinkMax,
  verifyMaxLink,
} from '../../Core/services/max-link.service';
import type { MaxLinkStatus } from '../../Core/services/max-link.service';
import { useAppStore } from '../../Core/store/app.store';
import './MaxLinkCard.scss';

type Step = 'idle' | 'code_sent' | 'linked';

export function MaxLinkCard() {
  const token = useAppStore((state) => state.token);

  const [status, setStatus] = useState<MaxLinkStatus | null>(null);
  const [step, setStep] = useState<Step>('idle');

  const [maxUserIdInput, setMaxUserIdInput] = useState('');
  const [codeInput, setCodeInput] = useState('');

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingUnlink, setLoadingUnlink] = useState(false);
  const [loadingToggle, setLoadingToggle] = useState(false);

  const loadStatus = async () => {
    if (!token) return;
    setLoadingStatus(true);
    try {
      const data = await fetchMaxLinkStatus({ token });
      setStatus(data);
      setStep(data.linked ? 'linked' : 'idle');
    } catch {
      message.error('Не удалось загрузить статус привязки Max');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSendCode = async () => {
    if (!token) return;

    const trimmed = maxUserIdInput.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      message.warning('Введите числовой идентификатор Max (только цифры)');
      return;
    }

    setLoadingSend(true);
    try {
      await startMaxLink({ token }, trimmed);
      setStep('code_sent');
      message.success('Код отправлен в Max. Проверьте сообщения от бота.');
    } catch {
      message.error('Не удалось отправить код. Проверьте правильность Max ID.');
    } finally {
      setLoadingSend(false);
    }
  };

  const handleVerify = async () => {
    if (!token) return;

    const trimmed = codeInput.trim().toUpperCase();
    if (!trimmed) {
      message.warning('Введите код из Max');
      return;
    }

    setLoadingVerify(true);
    try {
      await verifyMaxLink({ token }, trimmed);
      setCodeInput('');
      setMaxUserIdInput('');
      await loadStatus();
      message.success('Max успешно привязан!');
    } catch {
      message.error('Неверный или просроченный код. Попробуйте получить новый.');
    } finally {
      setLoadingVerify(false);
    }
  };

  const handleUnlink = async () => {
    if (!token) return;
    setLoadingUnlink(true);
    try {
      await unlinkMax({ token });
      setStatus((prev) => prev ? { ...prev, linked: false, maxUserId: null, verifiedAt: null } : prev);
      setStep('idle');
      setMaxUserIdInput('');
      setCodeInput('');
      message.success('Max отвязан');
    } catch {
      message.error('Не удалось отвязать Max');
    } finally {
      setLoadingUnlink(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    if (!token) return;
    setLoadingToggle(true);
    try {
      await toggleMaxNotifications({ token }, enabled);
      setStatus((prev) => prev ? { ...prev, notificationsEnabled: enabled } : prev);
    } catch {
      message.error('Не удалось изменить настройку уведомлений');
    } finally {
      setLoadingToggle(false);
    }
  };

  return (
    <Card className="max-link-card" title="Уведомления в Max" loading={loadingStatus}>

      {step === 'linked' && status && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <div className="max-link-card__row">
            <Tag color="green">Привязан</Tag>
            {status.maxUserId && (
              <Typography.Text type="secondary">ID: {status.maxUserId}</Typography.Text>
            )}
          </div>

          <div className="max-link-card__row">
            <Typography.Text>Получать уведомления</Typography.Text>
            <Switch
              checked={status.notificationsEnabled}
              onChange={handleToggle}
              loading={loadingToggle}
            />
          </div>

          <Button
            danger
            size="small"
            loading={loadingUnlink}
            onClick={() => void handleUnlink()}
          >
            Отвязать Max
          </Button>
        </Space>
      )}

      {step === 'idle' && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Привяжите аккаунт Max, чтобы получать уведомления о новых заявках прямо в чат-боте.
          </Typography.Text>

          <Alert
            type="info"
            showIcon={false}
            className="max-link-card__hint"
            message={
              <div>
                <Typography.Text strong>Как узнать свой Max ID:</Typography.Text>
                <ol className="max-link-card__steps">
                  <li>Откройте Max и найдите бота <Typography.Text code>CHECK ID</Typography.Text></li>
                  <li>Напишите ему любое сообщение</li>
                  <li>Скопируйте полученный числовой ID и вставьте ниже</li>
                </ol>
              </div>
            }
          />

          <div className="max-link-card__field">
            <Typography.Text>Ваш Max ID</Typography.Text>
            <Input
              placeholder="Например: 54321678"
              value={maxUserIdInput}
              onChange={(e) => setMaxUserIdInput(e.target.value.replace(/\D/g, ''))}
              onPressEnter={() => void handleSendCode()}
              style={{ maxWidth: 240 }}
            />
          </div>

          <Button
            type="primary"
            loading={loadingSend}
            disabled={!maxUserIdInput.trim()}
            onClick={() => void handleSendCode()}
          >
            Отправить код в Max
          </Button>
        </Space>
      )}

      {step === 'code_sent' && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            type="success"
            showIcon
            message="Код отправлен"
            description={`Бот отправил одноразовый код на Max ID: ${maxUserIdInput}. Проверьте сообщения и введите код ниже.`}
          />

          <div className="max-link-card__field">
            <Typography.Text>Код из Max</Typography.Text>
            <Input
              placeholder="Например: A1B2C3D4"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onPressEnter={() => void handleVerify()}
              style={{ maxWidth: 240 }}
              maxLength={8}
            />
          </div>

          <Space>
            <Button
              type="primary"
              loading={loadingVerify}
              disabled={!codeInput.trim()}
              onClick={() => void handleVerify()}
            >
              Подтвердить
            </Button>
            <Button
              loading={loadingSend}
              onClick={() => void handleSendCode()}
            >
              Отправить новый код
            </Button>
            <Button onClick={() => { setStep('idle'); setCodeInput(''); }}>
              Изменить ID
            </Button>
          </Space>
        </Space>
      )}

    </Card>
  );
}
