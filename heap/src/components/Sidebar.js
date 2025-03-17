import React from 'react';
import { Link } from 'react-router-dom';

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <ul>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/results">Results</Link></li>
        {/* Add more links as needed */}
      </ul>
    </aside>
  );
};

export default Sidebar;

