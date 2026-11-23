import { Button, Form, Input, Typography, Alert } from 'antd';
import { useState } from 'react';

import { changePassword } from '../Core/services/auth.service';
import { useAppStore } from '../Core/store/app.store';
import './ChangePasswordPage.scss';

const { Title, Paragraph } = Typography;

type FormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

/**
 * Экран обязательной смены временного пароля.
 * Показывается вместо основного кабинета когда mustChangePassword=TRUE.
 * Доступны только: смена пароля, /me, выход.
 */
export function ChangePasswordPage() {
  const user = useAppStore((s) => s.user);
  const token = useAppStore((s) => s.token);
  const minPasswordLength = user?.role === 'employee' ? 8 : 15;
  const setAuth = useAppStore((s) => s.setAuth);
  const clearAuth = useAppStore((s) => s.clearAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<FormValues>();

  const handleSubmit = async (values: FormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      setError('Новые пароли не совпадают');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await changePassword(
        { currentPassword: values.currentPassword, newPassword: values.newPassword },
        token!,
      );
      setAuth({ user: result.user, token: result.token });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка смены пароля';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-page">
      <div className="change-password-page__card">
        <Title level={3}>Смена пароля</Title>
        <Paragraph type="secondary">
          Вы вошли с временным паролем. Необходимо установить постоянный пароль перед продолжением работы.
        </Paragraph>
        <Paragraph type="secondary">
          <strong>Пользователь:</strong> {user?.fullName}
        </Paragraph>

        {error && (
          <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />
        )}

        <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item
            name="currentPassword"
            label="Текущий пароль"
            rules={[{ required: true, message: 'Введите текущий пароль' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label={`Новый пароль (минимум ${minPasswordLength} символов)`}
            rules={[
              { required: true, message: 'Введите новый пароль' },
              { min: minPasswordLength, message: `Минимум ${minPasswordLength} символов` },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Подтвердите новый пароль"
            rules={[{ required: true, message: 'Подтвердите новый пароль' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <div className="change-password-page__actions">
            <Button type="primary" htmlType="submit" loading={loading} block>
              Сменить пароль
            </Button>
            <Button type="link" onClick={clearAuth} danger>
              Выйти
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
