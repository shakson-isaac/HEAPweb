import React from 'react';

const Downloads = () => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/data/d1.csv';
    link.download = 'd1.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex p-6">
      <div className="flex-1">
        <h2 className="text-2xl font-bold">Downloads</h2>
        <button onClick={handleDownload} className="mt-4 p-2 bg-blue-500 text-white rounded">
          Download d1.csv
        </button>
      </div>
    </div>
  );
};

export default Downloads;
