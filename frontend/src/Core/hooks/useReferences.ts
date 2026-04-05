import { useEffect } from 'react';

import { useAppStore } from '../store/app.store';
import { fetchDepartments, fetchIncidentTypes } from '../services/incident.service';

export function useReferences(): void {
  const setDepartments = useAppStore((state) => state.setDepartments);
  const setIncidentTypes = useAppStore((state) => state.setIncidentTypes);

  useEffect(() => {
    const loadReferences = async () => {
      try {
        const [departments, incidentTypes] = await Promise.all([
          fetchDepartments(),
          fetchIncidentTypes(),
        ]);

        setDepartments(departments);
        setIncidentTypes(incidentTypes);
      } catch {
        // Ошибки загрузки будут обработаны на уровне страницы при необходимости.
      }
    };

    void loadReferences();
  }, [setDepartments, setIncidentTypes]);
}
