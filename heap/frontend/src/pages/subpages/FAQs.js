import React, { useState } from 'react';
import './FAQs.css'; // Add a CSS file for styling

const FAQs = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="content container">
      <h1 className="heading">FAQs</h1>
      <p className="paragraph">
        This section provides answers to frequently asked questions about HEAP. It covers topics such as data usage, analysis methods, and interpretation of results.
      </p>
      <ul className="faq-list">
        <li>
          <strong onClick={() => toggleFAQ(0)} className={`faq-question ${openIndex === 0 ? 'active' : ''}`}>
            <span role="img" aria-label="question-mark" style={{ color: '#28a745', marginRight: '8px' }}>❓</span>
            What is the exposome?
          </strong>
          {openIndex === 0 && (
            <p className="faq-answer">
              The exposome is the totality of a person's environmental exposures—lifestyle, social, and chemical—that influence health over their lifetime (Vermeulen et al., 2020).
            </p>
          )}
        </li>
        <li>
          <strong onClick={() => toggleFAQ(1)} className={`faq-question ${openIndex === 1 ? 'active' : ''}`}>
            <span role="img" aria-label="question-mark" style={{ color: '#28a745', marginRight: '8px' }}>❓</span>
            What is the plasma proteome?
          </strong>
          {openIndex === 1 && (
            <>
              <p className="faq-answer">
                The plasma proteome is the complete set of proteins found in blood plasma.
              </p>
              <p className="faq-answer">
                These proteins offer insights into biological processes such as hormone regulation, immune responses, and disease states (Anderson et al., 2002).
              </p>
            </>
          )}
        </li>
        <li>
          <strong onClick={() => toggleFAQ(2)} className={`faq-question ${openIndex === 2 ? 'active' : ''}`}>
            <span role="img" aria-label="question-mark" style={{ color: '#28a745', marginRight: '8px' }}>❓</span>
            How should I use HEAP?
          </strong>
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
