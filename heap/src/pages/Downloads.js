import React from 'react';

const Downloads = () => {
  const handleDownload = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/download/d1.csv', {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      // Create a Blob from the response data
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'd1.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
    }
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
