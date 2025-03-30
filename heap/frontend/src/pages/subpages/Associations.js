import React, { useState, useEffect }  from 'react';
import Select from 'react-select';  // Import React Select for searchable dropdown

function Associations() {
  // State to store the selected protein and list of proteins
  const [proteins, setProteins] = useState([]);
  const [selectedProtein, setSelectedProtein] = useState(null);
  
  // Fetch the proteins from the backend when the component mounts
  useEffect(() => {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/proteins`)  // Flask API endpoint
      .then((response) => response.json())
      .then((data) => {
        setProteins(data);  // Store the protein list in state
        setSelectedProtein(data[1571]);  // Set the first protein as the default selection
      })
      .catch((error) => console.error('Error fetching protein list:', error));
  }, []);
  
  // Function to handle the protein selection change
  const handleProteinChange = (selectedOption) => {
    setSelectedProtein(proteins.find(protein => protein.id === selectedOption.value));  // Match the selected protein by ID
  };

  // Construct the iframe src dynamically based on the selected protein's id
  const iframeSrc = selectedProtein
    ? `${process.env.REACT_APP_BACKEND_URL}/data/${selectedProtein.id}_Type6assoc.html`
    : '';  // Default empty src until a protein is selected

  // Log iframeSrc to the console for debugging
  console.log(iframeSrc);

    // Conditionally render the iframe only if selectedProtein exists
  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold">Protein Associations</h3>
      <p>Select a protein to view its interactive plot:</p>

      {/* Protein Dropdown using React Select */}
      <div className="dropdown">
        <label htmlFor="protein-select" className="mr-2">Select Protein:</label>
        <Select
          id="protein-select"
          value={selectedProtein ? { value: selectedProtein.id, label: `${selectedProtein.id} - ${selectedProtein.name}` } : null}
          onChange={handleProteinChange}
          options={proteins.map(protein => ({
            value: protein.id, 
            label: `${protein.id} - ${protein.name}`  // Show both the ID and the Name
          }))}
          placeholder="Search and Select a Protein"
          isSearchable={true}  // Make the dropdown searchable
        />
      </div>

      {/* Interactive Plot iframe, only rendered if selectedProtein is not null */}
      {selectedProtein && (
        <div className="interactive-plot">
          <iframe
            title="Interactive Plot"
            src={iframeSrc}  // Dynamically set iframe source based on selected protein
            width="100%" 
            height="600px" 
            frameBorder="0"
          />
        </div>
      )}
    </div>
  );
}

export default Associations;
