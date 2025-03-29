import React, { useState, useEffect } from 'react';
import Select from 'react-select';

const Interactions = () => {
  const [interactionOptions, setInteractionOptions] = useState([]);
  const [selectedInteraction, setSelectedInteraction] = useState(null);
  const [error, setError] = useState(null); // State to handle errors

  useEffect(() => {
    const fetchInteractionOptions = async () => {
      try {
        const response = await fetch(`/api/interactions`); // Use relative URL
        if (!response.ok) {
          throw new Error(`Error fetching interactions: ${response.statusText}`);
        }
        const data = await response.json();
        const options = data.map((file) => ({
          value: file,
          label: file.replace('.png', '').replace(/_/g, ' '), // Format the label
        }));
        setInteractionOptions(options);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch interaction options. Please try again later.');
      }
    };

    fetchInteractionOptions();
  }, []);

  const handleInteractionChange = (selectedOption) => {
    setSelectedInteraction(selectedOption);
  };

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold">Interactions</h3>
      <p>Select an interaction type to view its details:</p>

      {error && <p className="text-red-500">{error}</p>} {/* Display error message */}

      <div className="mt-4">
        <label htmlFor="interaction-select" className="mr-2">Select Interaction:</label>
        <Select
          id="interaction-select"
          value={selectedInteraction}
          onChange={handleInteractionChange}
          options={interactionOptions}
          placeholder="Search and Select an Interaction"
          isSearchable={true}
          isDisabled={!!error} // Disable dropdown if there's an error
        />
      </div>

      {selectedInteraction && (
        <div className="interactive-plot mt-8">
          <img
            src={`/data/interactions/${encodeURIComponent(selectedInteraction.value)}`} // Use relative URL
            alt={selectedInteraction.label}
            style={{ width: '1000px', maxHeight: '600px', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  );
};

export default Interactions;
