import React, { useEffect, useState } from 'react';

const Downloads = () => {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/downloads`);
        if (!response.ok) {
          throw new Error('Failed to fetch files');
        }
        const data = await response.json();
        setFiles(data);
      } catch (error) {
        console.error('Error fetching files:', error);
      }
    };

    fetchFiles();
  }, []);

  const handleDownload = async (filename) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/download/${filename}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
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
        <div className="mt-4">
          {files.map((file) => (
            <button
              key={file}
              onClick={() => handleDownload(file)}
              className="m-2 p-2 bg-blue-500 text-white rounded"
            >
              Download {file}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Downloads;
