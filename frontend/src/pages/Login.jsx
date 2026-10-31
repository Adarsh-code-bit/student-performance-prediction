import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, LogIn, Mail, Lock, AlertCircle, Shield, CheckCircle2, Warehouse } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.message || 'Invalid operator credentials. Please check your email and password.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to connect to warehouse API gateway. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { email: 'admin@example.com', role: 'Admin', desc: 'Full System HQ Control', tag: 'HQ' },
    { email: 'manager@example.com', role: 'Store Manager', desc: 'Dark Store Ops Supervisor', tag: 'Store #1' },
    { email: 'picker@example.com', role: 'Picker', desc: 'Order Fulfillment Terminal', tag: 'Floor' },
    { email: 'auditor@example.com', role: 'Auditor', desc: 'Inventory Cycle Counts', tag: 'Audit' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top left, #1a4d3b 0%, #12372A 60%, #091c15 100%)',
      padding: '24px 16px',
      fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      {/* Background Decorative Grid */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(248, 203, 70, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(248, 203, 70, 0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Main Terminal Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '440px',
        background: '#FFFFFF',
        borderRadius: '20px',
        border: '1px solid #E5E9E4',
        boxShadow: '0 24px 60px rgba(18, 55, 42, 0.35), 0 4px 16px rgba(0, 0, 0, 0.12)',
        padding: '36px 32px',
        boxSizing: 'border-box'
      }}>
        {/* Brand & Terminal Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {/* Logo Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            background: '#12372A',
            border: '2px solid #F8CB46',
            borderRadius: '16px',
            boxShadow: '0 8px 20px rgba(18, 55, 42, 0.35)',
            marginBottom: '16px',
            position: 'relative'
          }}>
            <Zap size={30} color="#F8CB46" fill="#F8CB46" />
            <span style={{
              position: 'absolute',
              bottom: '-6px',
              right: '-6px',
              width: '18px',
              height: '18px',
              background: '#168A45',
              borderRadius: '50%',
              border: '2px solid #FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Warehouse size={10} color="#FFFFFF" />
            </span>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#E8F5ED',
            color: '#168A45',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#168A45' }} />
            Quick-Commerce Dark Store OS
          </div>

          <h1 style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#17211B',
            letterSpacing: '-0.5px',
            margin: '4px 0'
          }}>
            QUICK<span style={{ color: '#168A45' }}>STOCK</span>
          </h1>

          <p style={{
            fontSize: '13px',
            color: '#68736B',
            fontWeight: 500,
            margin: 0
          }}>
            Internal Warehouse & Inventory Terminal
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: '#FDF2F2',
            border: '1px solid rgba(220, 53, 69, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={18} color="#DC3545" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '13px', color: '#DC3545', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
              {error}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email Field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#17211B',
              marginBottom: '6px'
            }}>
              Operator Email
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#68736B',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Mail size={16} />
              </div>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@darkstore.internal"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 14px 11px 40px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  color: '#17211B',
                  background: '#F7F8F5',
                  border: '1.5px solid #E5E9E4',
                  borderRadius: '10px',
                  outline: 'none',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#168A45';
                  e.target.style.boxShadow = '0 0 0 3px rgba(22, 138, 69, 0.15)';
                  e.target.style.background = '#FFFFFF';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E5E9E4';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = '#F7F8F5';
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#17211B',
              marginBottom: '6px'
            }}>
              Terminal Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#68736B',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Lock size={16} />
              </div>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 14px 11px 40px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  color: '#17211B',
                  background: '#F7F8F5',
                  border: '1.5px solid #E5E9E4',
                  borderRadius: '10px',
                  outline: 'none',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#168A45';
                  e.target.style.boxShadow = '0 0 0 3px rgba(22, 138, 69, 0.15)';
                  e.target.style.background = '#FFFFFF';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E5E9E4';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = '#F7F8F5';
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'inherit',
              color: '#FFFFFF',
              background: loading ? '#9AA39D' : '#168A45',
              border: 'none',
              borderRadius: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(22, 138, 69, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#127339';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(22, 138, 69, 0.45)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#168A45';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(22, 138, 69, 0.35)';
              }
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '2.5px solid rgba(255,255,255,0.4)',
                  borderTop: '2.5px solid #FFFFFF',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite'
                }} />
                Authenticating Terminal...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Access Warehouse Terminal
              </>
            )}
          </button>
        </form>

        {/* Create Account Link */}
        <div style={{
          marginTop: '18px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#68736B'
        }}>
          <span>New warehouse operator? </span>
          <button
            id="login-create-account-link"
            type="button"
            onClick={() => navigate('/signup')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#168A45',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: 'inherit',
              fontSize: '13px'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Demo Operators Switcher */}
        <div style={{
          marginTop: '24px',
          padding: '14px 16px',
          background: '#F7F8F5',
          borderRadius: '12px',
          border: '1px solid #E5E9E4'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#68736B',
              textTransform: 'uppercase',
              letterSpacing: '0.6px'
            }}>
              Quick-Fill Demo Roles
            </span>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 600,
              background: '#FDF3D0',
              color: '#785600',
              padding: '1px 6px',
              borderRadius: '6px',
              border: '1px solid rgba(248, 203, 70, 0.4)'
            }}>
              password123
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px'
          }}>
            {demoAccounts.map(demo => (
              <button
                key={demo.email}
                type="button"
                onClick={() => {
                  setEmail(demo.email);
                  setPassword('password123');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: '#FFFFFF',
                  border: '1px solid #E5E9E4',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#168A45';
                  e.currentTarget.style.background = '#E8F5ED';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E9E4';
                  e.currentTarget.style.background = '#FFFFFF';
                }}
                title={`${demo.email} (${demo.desc})`}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#17211B' }}>
                    {demo.role}
                  </div>
                  <div style={{ fontSize: '10px', color: '#68736B' }}>
                    {demo.tag}
                  </div>
                </div>
                <CheckCircle2 size={13} color="#168A45" style={{ opacity: 0.6 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          fontSize: '11px',
          color: '#9AA39D',
          fontWeight: 500
        }}>
          QUICKSTOCK v3.0 · Dark Store High-Velocity WMS
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;
