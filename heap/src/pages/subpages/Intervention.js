import React, { useState, useEffect } from 'react';
import Select from 'react-select';

function Intervention() {
  const [interventions, setInterventions] = useState([]);
  const [selectedIntervention, setSelectedIntervention] = useState(null);

  useEffect(() => {
    fetch('http://127.0.0.1:5000/data/intervention/exposure_interv.csv')
      .then((response) => response.text())
      .then((data) => {
        const parsedData = data.split('\n').slice(1).map((line) => {
          const [origID, sID, ...nameParts] = line.split(',');
          const name = nameParts.join(',').replace(/"/g, ''); // Join name parts and remove quotes
          return { value: sID, label: name };
        });
        setInterventions(parsedData);
      })
      .catch((error) => console.error('Error fetching interventions:', error));
  }, []);

  const handleInterventionChange = (selectedOption) => {
    setSelectedIntervention(selectedOption);
  };

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold">Intervention</h3>
      <p>Here you can provide details about the intervention studies...</p>
      {/* Add more content for the Intervention page */}
      
      <div className="mt-4">
        <label htmlFor="intervention-select" className="mr-2">Select Intervention:</label>
        <Select
          id="intervention-select"
          value={selectedIntervention}
          onChange={handleInterventionChange}
          options={interventions}
          placeholder="Search and Select an Intervention"
          isSearchable={true}
        />
      </div>

      {selectedIntervention && (
        <div className="flex justify-between mt-8">
          <div className="interactive-plot">
            <iframe
              title="Interactive Plot 1"
              src={`http://127.0.0.1:5000/data/intervention/${selectedIntervention.value}_HERITAGE.html`}
              width="500px"
              height="400px"
              frameBorder="0"
            />
          </div>
          <div className="interactive-plot">
            <iframe
              title="Interactive Plot 2"
              src={`http://127.0.0.1:5000/data/intervention/${selectedIntervention.value}_GLP1_STEP1.html`}
              width="500px"
              height="400px"
              frameBorder="0"
            />
          </div>
          <div className="interactive-plot">
            <iframe
              title="Interactive Plot 3"
              src={`http://127.0.0.1:5000/data/intervention/${selectedIntervention.value}_GLP1_STEP2.html`}
              width="500px"
              height="400px"
              frameBorder="0"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Intervention;
