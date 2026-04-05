import { useState } from 'react';

import { DocumentsSection } from '../../components/DocumentsSection/DocumentsSection';
import { Footer } from '../../components/Footer/Footer';
import { Header } from '../../components/Header/Header';
import { HeroSection } from '../../components/HeroSection/HeroSection';
import { IncidentReportModal } from '../../components/IncidentReportModal/IncidentReportModal';
import { ItRequestModal } from '../../components/ItRequestModal/ItRequestModal';
import { NewsSection } from '../../components/NewsSection/NewsSection';
import './PromoPage.scss';

export function PromoPage() {
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [itRequestModalOpen, setItRequestModalOpen] = useState(false);

  return (
    <div className="promo-page">
      <Header />
      <main>
        <HeroSection
          onOpenIncidentModal={() => setIncidentModalOpen(true)}
          onOpenItRequestModal={() => setItRequestModalOpen(true)}
        />
        <NewsSection />
        <DocumentsSection />
      </main>
      <IncidentReportModal open={incidentModalOpen} onClose={() => setIncidentModalOpen(false)} />
      <ItRequestModal open={itRequestModalOpen} onClose={() => setItRequestModalOpen(false)} />
      <Footer />
    </div>
  );
}
