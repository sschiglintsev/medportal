import { Button, Form, Input, Typography, message } from 'antd';
import { useState } from 'react';

import { login } from '../Core/services/auth.service';
import { useAppStore } from '../Core/store/app.store';
import './LoginPage.scss';

type LoginFormValues = {
  username: string;
  password: string;
};

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const setAuth = useAppStore((state) => state.setAuth);

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const auth = await login(values);
      setAuth(auth);
      message.success('Вход выполнен');
    } catch {
      message.error('Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-page">
      <Typography.Title level={3}>Вход в систему</Typography.Title>
      <Form layout="vertical" onFinish={onFinish} className="login-page__form">
        <Form.Item name="username" label="Логин" rules={[{ required: true, message: 'Введите логин' }]}>
          <Input />
        </Form.Item>

        <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]}>
          <Input.Password />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={loading} block>
          Войти
        </Button>
      </Form>
    </section>
  );
}
