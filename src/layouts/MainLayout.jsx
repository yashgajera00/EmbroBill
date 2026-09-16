import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import authAPI from '../services/authAPI';
import logo from '../assets/logo.jpg';

export default function MainLayout({ user, onLogout, alert, clearAlert }) {
  const [showContactModal, setShowContactModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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

  const hideNavbar = !user || location.pathname === '/login';

  return (
    <div>
      {/* Top Navbar */}
      {!hideNavbar && (
        <nav className="navbar navbar-expand-lg navbar-dark no-print" style={{ backgroundColor: 'var(--sidebar-bg)', padding: '12px 20px', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}>
          <div className="container-fluid">
            {/* Logo / Brand */}
            <Link className="navbar-brand fw-bold d-flex align-items-center me-4" to="/dashboard">
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
                <li className="nav-item me-2">
                  <button 
                    type="button"
                    className="nav-link px-3 py-2 rounded border-0 bg-transparent text-start w-100-mobile d-flex align-items-center"
                    onClick={() => setShowContactModal(true)}
                    style={{ outline: 'none', boxShadow: 'none' }}
                  >
                    <i className="bi bi-telephone-fill me-1"></i> Contact Us
                  </button>
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
      <div id="content" style={{ padding: '30px', minHeight: 'calc(100vh - 65px)', display: 'flex', flexDirection: 'column' }}>
        {/* Message Notification Alert Section */}
        {alert && (
          <div 
            className="no-print" 
            style={{ 
              position: 'fixed', 
              top: '80px', 
              right: '30px', 
              zIndex: 10000, 
              minWidth: '280px',
              maxWidth: 'calc(100vw - 60px)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
              borderRadius: '8px'
            }}
          >
            <div className={`alert alert-${alert.type} alert-dismissible fade show mb-0`} role="alert" style={{ borderRadius: '8px' }}>
              {alert.message}
              <button type="button" className="btn-close" onClick={clearAlert} aria-label="Close"></button>
            </div>
          </div>
        )}

        {/* Main Content Render */}
        <Outlet />
      </div>

      {/* Contact Us Modal */}
      {showContactModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg text-start" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold d-flex align-items-center text-primary">
                  <i className="bi bi-envelope-fill me-2 text-primary"></i> Contact Us
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowContactModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <div className="p-3 bg-light rounded-3 mb-2">
                  <p className="fw-semibold text-black mb-2 small text-uppercase font-monospace">Developer Support Info</p>
                  <p className="mb-2 text-dark fs-5">
                    <strong>Yash Gajera</strong>
                  </p>
                  <p className="mb-0 text-black">
                    <i className="bi bi-envelope-fill me-1 text-primary"></i> <strong>Email:</strong> <a href="mailto:gajerayash999@gmail.com" className="text-decoration-none text-dark">gajerayash999@gmail.com</a>
                  </p>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button 
                  type="button" 
                  onClick={() => setShowContactModal(false)} 
                  className="btn btn-primary btn-sm px-4"
                  style={{ borderRadius: '8px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
