import { ConfigProvider } from 'antd';

import { useAppStore } from './Core/store/app.store';
import { MainLayout } from './layouts/MainLayout';
import { AdminCabinetPage } from './pages/AdminCabinetPage';
import { PromoPage } from './pages/Promo/PromoPage';
import { QualityControlCabinetPage } from './pages/QualityControlCabinetPage';

function App() {
  const user = useAppStore((state) => state.user);
  const portalView = useAppStore((state) => state.portalView);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4C4FEA',
        },
      }}
    >
      {(user?.role === 'Администратор' || user?.role === 'Контроль качества') &&
      portalView === 'cabinet' ? (
        <MainLayout>
          {user.role === 'Контроль качества' ? <QualityControlCabinetPage /> : <AdminCabinetPage />}
        </MainLayout>
      ) : (
        <PromoPage />
      )}
    </ConfigProvider>
  );
}

export default App;
