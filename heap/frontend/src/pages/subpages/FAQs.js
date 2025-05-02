import React from 'react';

const FAQs = () => {
  return (
    <div className="content container">
      <h1 className="heading">FAQs</h1>
      <p className="paragraph">
        This section provides answers to frequently asked questions about HEAP. It covers topics such as data usage, analysis methods, and interpretation of results.
      </p>
      <ul className="faq-list">
        <li>
          <strong>What is the exposome?</strong>
          <p>
          The exposome is the totality of a person's environmental exposures—lifestyle, social, and chemical—that influence health over their lifetime (Vermeulen et al., 2020).<br />
          </p>
        </li>
        <li>
          <strong>What is the plasma proteome?</strong>
          <p>
            The plasma proteome is the complete set of proteins found in blood plasma.<br /> 
          </p>
          <p>
            These proteins offer insights into biological processes such as hormone regulation, immune respones, and disease states (Anderson et al., 2002).<br />
          </p>
        </li>
        <li>
          <strong>How should I use HEAP?</strong>
          <ul>
            <li>
              HEAP is a resource for researchers and clinicians to access how human plasma proteomics links modifiable lifestyle exposome to disease risk.
            </li>
            <li>
              View interactive HEAP results to gain further insight into specific lifestyle exposures that impact proteins of interest and whether these links tie to interventional studies on exercise and GLP1 agonists.
            </li>
            <li>
              Download HEAP summary statistics to connect how the modifable lifestyle exposome correlates with interventions or independent cohorts.
            </li>
            <li>
              Please cite HEAP in your publications: Isaac et al., Human Plasma Proteomics Links Modifiable Lifestyle Exposome to Disease Risk. In preparation.
            </li>
          </ul>
        </li>
      </ul>
      <div className="references">
        <h2 className="subheading">References and Citations</h2>
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
