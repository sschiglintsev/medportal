import { useState } from 'react';

import { AhchRequestModal } from '../../components/AhchRequestModal/AhchRequestModal';
import { DocumentsSection } from '../../components/DocumentsSection/DocumentsSection';
import { Footer } from '../../components/Footer/Footer';
import { Header } from '../../components/Header/Header';
import { HeroSection } from '../../components/HeroSection/HeroSection';
import { IncidentReportModal } from '../../components/IncidentReportModal/IncidentReportModal';
import { ItRequestModal } from '../../components/ItRequestModal/ItRequestModal';
import { MetrologistRequestModal } from '../../components/MetrologistRequestModal/MetrologistRequestModal';
import { NewsSection } from '../../components/NewsSection/NewsSection';
import './PromoPage.scss';

export function PromoPage() {
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [itRequestModalOpen, setItRequestModalOpen] = useState(false);
  const [ahchRequestModalOpen, setAhchRequestModalOpen] = useState(false);
  const [metrologistRequestModalOpen, setMetrologistRequestModalOpen] = useState(false);

  return (
    <div className="promo-page">
      <Header />
      <main>
        <HeroSection
          onOpenIncidentModal={() => setIncidentModalOpen(true)}
          onOpenItRequestModal={() => setItRequestModalOpen(true)}
          onOpenAhchRequestModal={() => setAhchRequestModalOpen(true)}
          onOpenMetrologistRequestModal={() => setMetrologistRequestModalOpen(true)}
        />
        <NewsSection />
        <DocumentsSection />
      </main>
      <IncidentReportModal open={incidentModalOpen} onClose={() => setIncidentModalOpen(false)} />
      <ItRequestModal open={itRequestModalOpen} onClose={() => setItRequestModalOpen(false)} />
      <AhchRequestModal open={ahchRequestModalOpen} onClose={() => setAhchRequestModalOpen(false)} />
      <MetrologistRequestModal
        open={metrologistRequestModalOpen}
        onClose={() => setMetrologistRequestModalOpen(false)}
      />
      <Footer />
    </div>
  );
}
