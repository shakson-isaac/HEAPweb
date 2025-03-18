import React from 'react';

function Associations() {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold">Associations</h3>
      <p>Here you can provide details about the associations...</p>
      <div className="interactive-plot">
        <iframe
          title="Interactive Plot"
          src="http://127.0.0.1:5000/data/IGFBP1_Type5assoc.html" // Use the relative path to the .html file in the public directory or external URL
          width="100%" 
          height="600px" 
          frameBorder="0"
        />
      </div>
    </div>
  );
}

export default Associations;
