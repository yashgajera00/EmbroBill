import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import authAPI from '../services/authAPI';
import logo from '../assets/logo.jpg';

export default function MainLayout({ user, onLogout, alert, clearAlert }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Reset scroll position on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await authAPI.logout();
      onLogout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const isActive = (paths) => {
    return paths.some(path => location.pathname === path || location.pathname.startsWith(path)) ? 'active' : '';
  };

  const isMobilePage = location.pathname === '/' || 
    location.pathname === '/home' || 
    location.pathname === '/dashboard' || 
    location.pathname === '/create-invoice' || 
    location.pathname.startsWith('/invoices/edit/') ||
    location.pathname === '/create-challan' || 
    location.pathname.startsWith('/challans/edit/') ||
    location.pathname === '/invoice-history' ||
    location.pathname === '/settings';
  const hideNavbar = !user || location.pathname === '/login' || isMobilePage;


  return (
    <div>
      {/* Top Navbar */}
      {!hideNavbar && (
        <nav className="navbar navbar-expand-lg navbar-dark no-print" style={{ backgroundColor: 'var(--sidebar-bg)', padding: '12px 20px', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}>
          <div className="container-fluid">
            {/* Logo / Brand */}
            <Link className="navbar-brand fw-bold d-flex align-items-center me-4" to="/" title="Go to Home">
              <img 
                src={logo} 
                alt="Logo" 
                className="me-2" 
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '6px', 
                  objectFit: 'cover' 
                }} 
              />
              EmbroBill
            </Link>

            {/* Hamburger Toggle Button */}
            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#topNavbarContent"
              aria-controls="topNavbarContent"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon"></span>
            </button>

            {/* Collapsible Navbar content */}
            <div className="collapse navbar-collapse" id="topNavbarContent">
              {/* Left Side Links */}
              <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                <li className="nav-item me-2">
                  <Link className={`nav-link px-3 py-2 rounded ${location.pathname === '/' || location.pathname === '/home' ? 'active' : ''}`} to="/">
                    <i className="bi bi-house-door me-1"></i> Home
                  </Link>
                </li>
                <li className="nav-item me-2">
                  <Link className={`nav-link px-3 py-2 rounded ${isActive(['/dashboard'])}`} to="/dashboard">
                    <i className="bi bi-speedometer2 me-1"></i> Dashboard
                  </Link>
                </li>
                <li className="nav-item me-2">
                  <Link className={`nav-link px-3 py-2 rounded ${isActive(['/create-invoice'])}`} to="/create-invoice">
                    <i className="bi bi-plus-circle me-1"></i> Create Invoice
                  </Link>
                </li>
                <li className="nav-item me-2">
                  <Link className={`nav-link px-3 py-2 rounded ${isActive(['/create-challan'])}`} to="/create-challan">
                    <i className="bi bi-truck me-1"></i> Delivery Challan
                  </Link>
                </li>
                <li className="nav-item me-2">
                  <Link className={`nav-link px-3 py-2 rounded ${isActive(['/invoice-history'])}`} to="/invoice-history">
                    <i className="bi bi-file-earmark-text me-1"></i> Invoice History
                  </Link>
                </li>
              </ul>

              {/* Right Side Info & Actions */}
              <div className="d-flex align-items-lg-center flex-column flex-lg-row mt-2 mt-lg-0 gap-2">
                <span className="navbar-text me-lg-3 mb-2 mb-lg-0 text-white-50">
                  Welcome, <strong className="text-white">{user.username}</strong>
                </span>
                <Link to="/settings" className={`btn btn-outline-light btn-sm d-flex align-items-center ${isActive(['/settings'])}`} title="Company Settings">
                  <i className="bi bi-gear-fill me-1"></i> Settings
                </Link>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Page Content Container */}
      <div 
        id="content" 
        style={{ 
          padding: isMobilePage ? '0' : '24px 0', 
          minHeight: isMobilePage ? '100vh' : 'calc(100vh - 65px)', 
          height: isMobilePage ? '100vh' : 'auto',
          maxHeight: isMobilePage ? '100vh' : 'none',
          overflow: isMobilePage ? 'hidden' : 'visible',
          backgroundColor: isMobilePage ? '#0b1120' : 'transparent',
          display: 'flex', 
          flexDirection: 'column' 
        }}
      >
        {/* Main Content Render */}
        <Outlet />
      </div>
    </div>
  );
}
