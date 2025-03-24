import React from 'react';

function Intervention() {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold">Intervention</h3>
      <p>Here you can provide details about the intervention studies...</p>
      {/* Add more content for the Intervention page */}
      
      <div className="flex justify-between mt-8">
        <div className="interactive-plot">
          <iframe
            title="Interactive Plot 1"
            src={`http://127.0.0.1:5000/data/intervention/E1_HERITAGE.html`}
            width="400px"
            height="300px"
            frameBorder="0"
          />
        </div>
        <div className="interactive-plot">
          <iframe
            title="Interactive Plot 2"
            src={`http://127.0.0.1:5000/data/intervention/E1_GLP1_STEP1.html`}
            width="400px"
            height="300px"
            frameBorder="0"
          />
        </div>
        <div className="interactive-plot">
          <iframe
            title="Interactive Plot 3"
            src={`http://127.0.0.1:5000/data/intervention/E1_GLP1_STEP2.html`}
            width="400px"
            height="300px"
            frameBorder="0"
          />
        </div>
      </div>
    </div>
  );
}

export default Intervention;
