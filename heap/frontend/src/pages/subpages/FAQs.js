import React, { useState } from 'react';
import './FAQs.css'; // Add a CSS file for styling
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined'; // Import Material-UI quiz icon

const FAQs = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="content container">
      <h1 className="heading">FAQs</h1>
      <ul className="faq-list">
        <li className="faq-item">
          <div className="faq-header" onClick={() => toggleFAQ(0)}>
            <QuizOutlinedIcon style={{ color: '#124533db', marginRight: '12px' }} /> {/* Green quiz icon */}
            <span className="faq-question">What is the exposome?</span>
          </div>
          {openIndex === 0 && (
            <ul className="faq-answer">
              <li>
                The exposome is the totality of a person's environmental exposures—lifestyle, social, and chemical.
              </li>
              <li>
                These exposures influence health over their lifetime (Vermeulen et al., 2020).
              </li>
            </ul>
          )}
        </li>
        <li className="faq-item">
          <div className="faq-header" onClick={() => toggleFAQ(1)}>
            <QuizOutlinedIcon style={{ color: '#124533db', marginRight: '12px' }} /> {/* Green quiz icon */}
            <span className="faq-question">What is the plasma proteome?</span>
          </div>
          {openIndex === 1 && (
            <ul className="faq-answer">
              <li>
                The plasma proteome is the complete set of proteins found in blood plasma.
              </li>
              <li>
                These proteins offer insights into biological processes such as hormone regulation, immune responses, and disease states (Anderson et al., 2002) 
              </li>
            </ul>
          )}
        </li>
        <li className="faq-item">
          <div className="faq-header" onClick={() => toggleFAQ(2)}>
            <QuizOutlinedIcon style={{ color: '#124533db', marginRight: '12px' }} /> {/* Green quiz icon */}
            <span className="faq-question">How should I use HEAP?</span>
          </div>
          {openIndex === 2 && (
            <ul className="faq-answer">
              <li>
                HEAP is a resource for researchers and clinicians to access how human plasma proteomics links modifiable lifestyle exposome to disease risk.
              </li>
              <li>
                View interactive HEAP results to gain further insight into specific lifestyle exposures that impact proteins of interest and whether these links tie to interventional studies on exercise and GLP1 agonists.
              </li>
              <li>
                Download HEAP summary statistics to connect how the modifiable lifestyle exposome correlates with interventions or independent cohorts.
              </li>
              <li>
                Please cite HEAP in your publications: Isaac et al., Human Plasma Proteomics Links Modifiable Lifestyle Exposome to Disease Risk. In preparation.
              </li>
            </ul>
          )}
        </li>
      </ul>
      <div className="references">
        <h2 className="subheading">References</h2>
        <ul className="references-list">
          <li>
            Vermeulen, R., Schymanski, E. L., Barabási, A.-L. & Miller, G. W. The exposome and health: Where chemistry meets biology. Science 367, 392-396 (2020).
          </li>
          <li>
            Anderson, N. L. & Anderson, N. G. The human plasma proteome: history, character, and diagnostic prospects. Mol. Cell. Proteomics 1, 845-867 (2002).
          </li>
        </ul>
      </div>
    </div>
  );
};

export default FAQs;
