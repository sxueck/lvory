import React from 'react';
import '../assets/css/sidebar.css';
import SystemStatus from './SystemStatus';
import logoSvg from '../../resource/icon/logo.svg';

const Sidebar = ({ activeItem, onItemClick, profilesCount }) => {
  return (
    <div className="sidebar">
      <div className="logo">
        <img src={logoSvg} alt="LVORY Logo" className="logo-image" />
        <h2>LVORY</h2>
      </div>
      
      <div className="main-menu">
        <ul>
          <li 
            className={`menu-item ${activeItem === 'dashboard' ? 'active' : ''}`}
            onClick={() => onItemClick('dashboard')}
          >
            <span className="icon home-icon"></span>
            <span>Dashboard</span>
          </li>
          <li 
            className={`menu-item ${activeItem === 'activity' ? 'active' : ''}`}
            onClick={() => onItemClick('activity')}
          >
            <span className="icon activity-icon"></span>
            <span>Activity</span>
          </li>
          <li 
            className={`menu-item ${activeItem === 'profiles' ? 'active' : ''}`}
            onClick={() => onItemClick('profiles')}
          >
            <span className="icon profiles-icon"></span>
            <span>Profiles</span>
            <span className="badge">{profilesCount || 0}</span>
          </li>
          <li 
            className={`menu-item ${activeItem === 'settings' ? 'active' : ''}`}
            onClick={() => onItemClick('settings')}
          >
            <span className="icon settings-icon"></span>
            <span>Settings</span>
          </li>
        </ul>
      </div>

      <SystemStatus />
    </div>
  );
};

export default Sidebar; 