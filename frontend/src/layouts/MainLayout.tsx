import { Layout } from 'antd';
import type { ReactNode } from 'react';

import { HeaderBar } from '../components/HeaderBar';
import './MainLayout.scss';

type MainLayoutProps = {
  children: ReactNode;
};

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <Layout className="main-layout">
      <HeaderBar />
      <Layout.Content className="main-layout__content">{children}</Layout.Content>
    </Layout>
  );
}
