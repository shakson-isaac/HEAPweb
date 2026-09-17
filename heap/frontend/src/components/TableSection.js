import React from 'react';
import SectionCard from './SectionCard';
import ColumnarTable from './ColumnarTable';
import { useSection } from '../lib/useSection';

// A whole section rendered as a browsable table. Every payload section can fall
// back to this, so a result is never unreachable just because it has no bespoke chart.
export default function TableSection({ section, title, subtitle, rowsPerPage }) {
  const { data, loading, error } = useSection(section);
  return (
    <SectionCard title={title} subtitle={subtitle} loading={loading} error={error}>
      {data && <ColumnarTable data={data} initialRowsPerPage={rowsPerPage || 10} />}
    </SectionCard>
  );
}
