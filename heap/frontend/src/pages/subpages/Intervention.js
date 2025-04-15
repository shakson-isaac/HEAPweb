import React, { useState, useEffect } from 'react';
import Select from 'react-select';

function Intervention() {
  const [interventions, setInterventions] = useState([]);
  const [selectedIntervention, setSelectedIntervention] = useState(null);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/data/intervention/exposure_interv.csv`) // Use relative URL
      .then((response) => response.text())
      .then((data) => {
        const parsedData = data.split('\n').slice(1).map((line) => {
          const [, sID, ...nameParts] = line.split(','); // Ignore origID
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
      <p>Comparison between HEAP association in the UKB to interventional studies of exercise (HERITAGE study) and GLP1 agonists (STEP1/STEP2 trials)</p>
      
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
              src={`${process.env.REACT_APP_BACKEND_URL}/data/intervention/${selectedIntervention.value}_HERITAGE.html`} // Use relative URL
              width="500px"
              height="400px"
              frameBorder="0"
            />
          </div>
          <div className="interactive-plot">
            <iframe
              title="Interactive Plot 2"
              src={`${process.env.REACT_APP_BACKEND_URL}/data/intervention/${selectedIntervention.value}_GLP1_STEP1.html`} // Use relative URL
              width="500px"
              height="400px"
              frameBorder="0"
            />
          </div>
          <div className="interactive-plot">
            <iframe
              title="Interactive Plot 3"
              src={`${process.env.REACT_APP_BACKEND_URL}/data/intervention/${selectedIntervention.value}_GLP1_STEP2.html`} // Use relative URL
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
