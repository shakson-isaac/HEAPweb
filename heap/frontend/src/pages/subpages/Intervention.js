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
      <p>
        Comparison between HEAP association in the UKB to interventional studies of exercise 
        (<a href="https://www.heritagefamilystudy.com" target="_blank" rel="noopener noreferrer">HERITAGE study</a>) 
        and GLP1 agonists 
        (<a href="https://www.novomedlink.com/semaglutide/medicines.html?gclsrc=aw.ds&&utm_source=google&utm_medium=cpc&utm_term=semaglutide%20nordisk&utm_campaign=1_All_Shared_BR_Semaglutide_General_2025&mkwid=s-dc_pcrid_734503182217_pkw_semaglutide%20nordisk_pmt_p_slid__product_&pgrid=178499665627&ptaid=kwd-1538961666692&gad_source=1&gbraid=0AAAAApjncxXCwEgrs68wC5ahbuGp5zP5G&gclid=Cj0KCQjwh_i_BhCzARIsANimeoFV1xrqltI_H4eW-20WjVaBVl6qsPtjE5f0-F7pm1HXEWQFMS1jYUQaAvTDEALw_wcB" target="_blank" rel="noopener noreferrer">STEP1/STEP2 trials</a>)
      </p>
      
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
