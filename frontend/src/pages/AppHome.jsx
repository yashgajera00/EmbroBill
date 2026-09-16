import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import settingsAPI from '../services/settingsAPI';
import logo from '../assets/logo.jpg';
import '../styles/appHome.css';

export default function AppHome({ user, onLogout, triggerAlert }) {
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);

  // Fetch company details for GST number
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const data = await settingsAPI.get();
        if (data) {
          setCompany(data);
        }
      } catch (err) {
        console.error('Failed to load company info for home screen:', err);
      }
    };
    fetchCompanyInfo();
  }, []);

  const username = user?.username || 'Yash';
  const gstNumber = company?.gst_number || '24AAACP1234F1Z5';

  return (
    <div className="app-home-wrapper">
      <div className="app-home-container">
        
        {/* Header matching screenshot */}
        <header className="app-home-header">
          <div className="app-home-header-top">
            <div className="app-home-header-left">
              <img src={logo} alt="EmbroBill Logo" className="app-home-logo-img" />
              <h1 className="app-home-brand-title">EmbroBill</h1>
            </div>
            <button 
              type="button" 
              className="app-home-settings-btn"
              onClick={() => navigate('/settings')}
              title="Settings"
              aria-label="Settings"
            >
              <i className="bi bi-gear"></i>
            </button>
          </div>
        </header>

        {/* 5 Main Option Cards matching screenshot */}
        <main className="app-home-body">
          {/* Sub-banner: Welcome, Yash & GST in Middle Part */}
          <div className="app-home-sub-banner">
            <p className="app-home-welcome-text">
              <span className="app-home-status-dot"></span>
              Welcome, <span className="app-home-welcome-name">{username}</span>
            </p>
            <span className="app-home-gst-badge">
              GST: {gstNumber}
            </span>
          </div>
          
          {/* Card 1: Dashboard */}
          <div 
            className="app-home-card card-theme-dashboard"
            onClick={() => navigate('/dashboard')}
            role="button"
            tabIndex={0}
          >
            <div className="app-home-card-left">
              <div className="app-home-card-icon-col">
                <div className="app-home-card-icon-box">
                  <i className="bi bi-grid-fill"></i>
                </div>
              </div>
              <div className="app-home-card-title-group">
                <span className="app-home-card-title">Dashboard</span>
              </div>
            </div>
            <i className="bi bi-chevron-right app-home-card-arrow"></i>
          </div>

          {/* Card 2: Create Invoice */}
          <div 
            className="app-home-card card-theme-invoice"
            onClick={() => navigate('/create-invoice')}
            role="button"
            tabIndex={0}
          >
            <div className="app-home-card-left">
              <div className="app-home-card-icon-col">
                <div className="app-home-card-icon-box">
                  <i className="bi bi-receipt"></i>
                </div>
              </div>
              <div className="app-home-card-title-group">
                <span className="app-home-card-title">Create Invoice</span>
              </div>
            </div>
            <i className="bi bi-chevron-right app-home-card-arrow"></i>
          </div>

          {/* Card 3: Create Challan */}
          <div 
            className="app-home-card card-theme-challan"
            onClick={() => navigate('/create-challan')}
            role="button"
            tabIndex={0}
          >
            <div className="app-home-card-left">
              <div className="app-home-card-icon-col">
                <div className="app-home-card-icon-box">
                  <i className="bi bi-truck"></i>
                </div>
              </div>
              <div className="app-home-card-title-group">
                <span className="app-home-card-title">Create Challan</span>
              </div>
            </div>
            <i className="bi bi-chevron-right app-home-card-arrow"></i>
          </div>

          {/* Card 4: Invoice History */}
          <div 
            className="app-home-card card-theme-history"
            onClick={() => navigate('/invoice-history')}
            role="button"
            tabIndex={0}
          >
            <div className="app-home-card-left">
              <div className="app-home-card-icon-col">
                <div className="app-home-card-icon-box">
                  <i className="bi bi-clock-history"></i>
                </div>
              </div>
              <div className="app-home-card-title-group">
                <span className="app-home-card-title">Invoice History</span>
              </div>
            </div>
            <i className="bi bi-chevron-right app-home-card-arrow"></i>
          </div>

        </main>

        {/* Bottom Navigation Bar */}
        <nav className="app-home-bottom-nav">
          <button 
            type="button" 
            className="app-home-bottom-tab active"
            onClick={() => {}}
            title="Home"
          >
            <i className="bi bi-house-door-fill"></i>
            <span>Home</span>
          </button>

          <button 
            type="button" 
            className="app-home-bottom-tab"
            onClick={() => navigate('/dashboard')}
            title="Dashboard"
          >
            <i className="bi bi-grid-fill"></i>
            <span>Dashboard</span>
          </button>
          
          <button 
            type="button" 
            className="app-home-bottom-tab"
            onClick={() => navigate('/create-invoice')}
            title="Invoices"
          >
            <i className="bi bi-receipt"></i>
            <span>Invoices</span>
          </button>

          <button 
            type="button" 
            className="app-home-bottom-tab"
            onClick={() => navigate('/invoice-history')}
            title="History"
          >
            <i className="bi bi-clock-history"></i>
            <span>History</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
