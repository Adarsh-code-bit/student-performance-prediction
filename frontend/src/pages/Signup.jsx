import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import {
  Zap,
  Warehouse,
  User,
  Phone,
  Mail,
  Lock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  Send,
  Clock,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Check
} from 'lucide-react';

const DEPARTMENTS = [
  'Picking & Fulfillment',
  'Packing & Dispatch',
  'Inventory Control & Auditing',
  'Inbound & Goods Receiving',
  'Warehouse Operations'
];

/**
 * Masks a mobile number to display prefix and last 4 digits only.
 * E.g. "+919876543210" -> "+91 ••••• •3210"
 * E.g. "9876543210" -> "•••••• 3210"
 */
function maskPhoneNumber(num) {
  if (!num) return '';
  const clean = num.trim();
  const digits = clean.replace(/\D/g, '');
  if (digits.length < 4) return clean;
  const lastFour = digits.slice(-4);
  const prefix = clean.startsWith('+') ? clean.slice(0, 3) + ' ' : '';
  return `${prefix}•••••• ${lastFour}`;
}

export default function Signup() {
  const navigate = useNavigate();

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [department, setDepartment] = useState('Picking & Fulfillment');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Mobile OTP Workflow State
  // Phase: 'IDLE' | 'SENDING' | 'SENT' | 'VERIFYING' | 'VERIFIED'
  const [otpPhase, setOtpPhase] = useState('IDLE');
  const [otpCode, setOtpCode] = useState('');
  const [isMobileVerified, setIsMobileVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Specific OTP Feedback & Error States
  // 'EXPIRED' | 'INVALID' | 'TOO_MANY_ATTEMPTS' | 'SMS_FAILURE' | 'GENERAL'
  const [otpErrorType, setOtpErrorType] = useState(null);
  const [otpErrorMessage, setOtpErrorMessage] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(null);

  // Overall Form Submission State
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [submittedData, setSubmittedData] = useState(null);

  // Field validation errors
  const [errors, setErrors] = useState({});

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Password strength helper
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, text: 'None', color: '#E5E9E4' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, text: 'Weak', color: '#DC3545' };
      case 2:
      case 3:
        return { score: 2, text: 'Medium', color: '#D97706' };
      case 4:
        return { score: 3, text: 'Strong', color: '#168A45' };
      default:
        return { score: 1, text: 'Weak', color: '#DC3545' };
    }
  };

  const strength = getPasswordStrength(password);

  // 1. Send OTP Request
  const handleSendOtp = async () => {
    setOtpErrorType(null);
    setOtpErrorMessage('');
    const cleanPhone = phone.trim();
    const digits = cleanPhone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      setErrors((prev) => ({ ...prev, phone: 'Please enter a valid 10 to 15 digit mobile number first.' }));
      return;
    }

    setOtpPhase('SENDING');
    try {
      const res = await api.post('/auth/send-otp', { phone: cleanPhone });
      if (res.data?.success) {
        setOtpPhase('SENT');
        setOtpCode('');
        setResendCooldown(45);
      }
    } catch (err) {
      const errCode = err.response?.data?.code;
      const errMsg = err.response?.data?.message || 'Failed to dispatch verification code via SMS.';

      if (errCode === 'SMS_DELIVERY_FAILURE') {
        setOtpErrorType('SMS_FAILURE');
      } else if (errCode === 'RATE_LIMIT_COOLDOWN' || err.response?.status === 429) {
        setOtpErrorType('TOO_MANY_ATTEMPTS');
      } else {
        setOtpErrorType('GENERAL');
      }

      setOtpErrorMessage(errMsg);
      setOtpPhase('IDLE');
    }
  };

  // 2. Verify OTP Code
  const handleVerifyOtp = async () => {
    setOtpErrorType(null);
    setOtpErrorMessage('');

    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpErrorType('INVALID');
      setOtpErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setOtpPhase('VERIFYING');
    try {
      const res = await api.post('/auth/verify-otp', {
        phone: phone.trim(),
        otp: otpCode.trim()
      });

      if (res.data?.success && res.data?.verified) {
        setIsMobileVerified(true);
        setVerificationToken(res.data.verification_token);
        setOtpPhase('VERIFIED');
        setOtpErrorType(null);
        setOtpErrorMessage('');
      }
    } catch (err) {
      const errCode = err.response?.data?.code;
      const errMsg = err.response?.data?.message || 'Invalid or expired verification code.';
      const remAttempts = err.response?.data?.remainingAttempts;

      setRemainingAttempts(remAttempts ?? null);

      if (errCode === 'OTP_EXPIRED') {
        setOtpErrorType('EXPIRED');
      } else if (errCode === 'TOO_MANY_ATTEMPTS' || err.response?.status === 429) {
        setOtpErrorType('TOO_MANY_ATTEMPTS');
      } else if (errCode === 'INVALID_OTP') {
        setOtpErrorType('INVALID');
      } else {
        setOtpErrorType('GENERAL');
      }

      setOtpErrorMessage(errMsg);
      setOtpPhase('SENT'); // Remain in verification tray so user can retry or resend
    }
  };

  // Reset OTP state if user wants to change verified phone
  const handleResetPhone = () => {
    setIsMobileVerified(false);
    setVerificationToken(null);
    setOtpPhase('IDLE');
    setOtpCode('');
    setOtpErrorType(null);
    setOtpErrorMessage('');
    setRemainingAttempts(null);
  };

  // Client-side form validation
  const validateForm = () => {
    const newErrors = {};

    if (!fullName || fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters.';
    }

    const digits = phone.replace(/\D/g, '');
    if (!phone || digits.length < 10 || digits.length > 15) {
      newErrors.phone = 'Valid 10 to 15 digit mobile number is required.';
    }

    if (!isMobileVerified || !verificationToken) {
      newErrors.mobileVerification = 'Mobile number verification is mandatory before registration.';
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Please enter a valid email address.';
      }
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    } else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      newErrors.password = 'Password must include both letters and numbers.';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit registration
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        user_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        employment_type: employmentType,
        department: department,
        password: password,
        confirm_password: confirmPassword,
        verification_token: verificationToken // Mandatory server challenge token
      };

      const res = await api.post('/auth/signup', payload);
      if (res.data?.success) {
        setSubmittedData(res.data.data);
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Unable to submit registration. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top left, #1a4d3b 0%, #12372A 60%, #091c15 100%)',
      padding: '32px 16px',
      fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      boxSizing: 'border-box'
    }}>
      {/* Decorative Grid */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(248, 203, 70, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(248, 203, 70, 0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Main Container Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '540px',
        background: '#FFFFFF',
        borderRadius: '20px',
        border: '1px solid #E5E9E4',
        boxShadow: '0 24px 60px rgba(18, 55, 42, 0.35), 0 4px 16px rgba(0, 0, 0, 0.12)',
        padding: '36px 32px',
        boxSizing: 'border-box'
      }}>
        {/* SUCCESS CONFIRMATION STATE */}
        {submittedData ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              backgroundColor: '#E8F5ED',
              color: '#168A45',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              border: '2px solid #BBF7D0'
            }}>
              <ShieldCheck size={36} color="#168A45" />
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#FEF3C7',
              color: '#B45309',
              border: '1px solid #FDE68A',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '12px'
            }}>
              <Clock size={13} />
              Pending Supervisor Approval
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#17211B', margin: '0 0 8px' }}>
              Registration Submitted!
            </h2>
            <p style={{ fontSize: '13.5px', color: '#68736B', lineHeight: 1.5, margin: '0 0 20px' }}>
              Welcome to the QUICKSTOCK dark store team. Your mobile number has been verified and your profile is routed to dark store operations for supervisor activation.
            </p>

            <div style={{
              backgroundColor: '#F7F8F5',
              borderRadius: '12px',
              border: '1px solid #E5E9E4',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12.5px' }}>
                <span style={{ color: '#68736B' }}>Employee Reference:</span>
                <strong style={{ color: '#17211B', fontFamily: 'monospace', fontWeight: 800 }}>{submittedData.employee_id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12.5px' }}>
                <span style={{ color: '#68736B' }}>Full Name:</span>
                <strong style={{ color: '#17211B' }}>{submittedData.user_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12.5px' }}>
                <span style={{ color: '#68736B' }}>Mobile Verified:</span>
                <strong style={{ color: '#168A45', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={14} /> {maskPhoneNumber(submittedData.phone)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12.5px' }}>
                <span style={{ color: '#68736B' }}>Employment Type:</span>
                <strong style={{ color: '#17211B' }}>{submittedData.employment_type === 'FULL_TIME' ? 'Full-Time' : 'Part-Time'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: '#68736B' }}>Department:</span>
                <strong style={{ color: '#168A45' }}>{submittedData.department}</strong>
              </div>
            </div>

            <button
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                padding: '13px',
                fontSize: '14px',
                fontWeight: 700,
                color: '#FFFFFF',
                backgroundColor: '#168A45',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <ArrowLeft size={16} /> Return to Terminal Login
            </button>
          </div>
        ) : (
          /* REGISTRATION FORM */
          <>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '52px',
                height: '52px',
                background: '#12372A',
                border: '2px solid #F8CB46',
                borderRadius: '14px',
                boxShadow: '0 8px 20px rgba(18, 55, 42, 0.35)',
                marginBottom: '12px',
                position: 'relative'
              }}>
                <Zap size={26} color="#F8CB46" fill="#F8CB46" />
                <span style={{
                  position: 'absolute',
                  bottom: '-5px',
                  right: '-5px',
                  width: '16px',
                  height: '16px',
                  background: '#168A45',
                  borderRadius: '50%',
                  border: '2px solid #FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Warehouse size={9} color="#FFFFFF" />
                </span>
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#E8F5ED',
                color: '#168A45',
                padding: '2px 8px',
                borderRadius: '20px',
                fontSize: '10.5px',
                fontWeight: 700,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                marginBottom: '6px'
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#168A45' }} />
                Dark Store Staff Registration
              </div>

              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#17211B', letterSpacing: '-0.4px', margin: '2px 0 6px' }}>
                Employee Account Setup
              </h1>
              <p style={{ fontSize: '13px', color: '#68736B', margin: 0 }}>
                Register your operator profile with mandatory mobile verification.
              </p>
            </div>

            {/* Error Alert for Form Submission */}
            {formError && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                background: '#FDF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: '10px',
                marginBottom: '18px',
                color: '#991B1B',
                fontSize: '13px'
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Full Name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#17211B', marginBottom: '5px' }}>
                  Full Name <span style={{ color: '#DC3545' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#68736B' }}>
                    <User size={16} />
                  </div>
                  <input
                    id="signup-fullname"
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors({ ...errors, fullName: null });
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px 10px 38px',
                      fontSize: '13.5px',
                      fontFamily: 'inherit',
                      color: '#17211B',
                      background: '#F7F8F5',
                      border: `1.5px solid ${errors.fullName ? '#DC3545' : '#E5E9E4'}`,
                      borderRadius: '10px',
                      outline: 'none'
                    }}
                  />
                </div>
                {errors.fullName && <div style={{ fontSize: '11px', color: '#DC3545', marginTop: '3px' }}>{errors.fullName}</div>}
              </div>

              {/* Mobile Number & OTP Verification Flow */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#17211B' }}>
                    Mobile Number <span style={{ color: '#DC3545' }}>*</span>
                  </label>
                  {isMobileVerified ? (
                    <span style={{
                      fontSize: '11.5px',
                      color: '#168A45',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#E8F5ED',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      <CheckCircle2 size={13} /> Mobile Number Verified
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#DC3545', fontWeight: 600 }}>
                      OTP Verification Mandatory
                    </span>
                  )}
                </div>

                {/* Mobile Input + Send OTP Action */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#68736B' }}>
                      <Phone size={16} />
                    </div>
                    <input
                      id="signup-phone"
                      type="tel"
                      required
                      placeholder="e.g. 9876543210 (10-15 digits)"
                      value={phone}
                      disabled={isMobileVerified || otpPhase === 'SENDING'}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (errors.phone) setErrors({ ...errors, phone: null });
                        if (otpPhase === 'SENT') {
                          setOtpPhase('IDLE');
                          setOtpCode('');
                        }
                      }}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 14px 10px 38px',
                        fontSize: '13.5px',
                        fontFamily: 'inherit',
                        color: '#17211B',
                        background: isMobileVerified ? '#F0FDF4' : '#F7F8F5',
                        border: `1.5px solid ${isMobileVerified ? '#168A45' : errors.phone ? '#DC3545' : '#E5E9E4'}`,
                        borderRadius: '10px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {!isMobileVerified ? (
                    <button
                      id="btn-send-otp"
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpPhase === 'SENDING' || resendCooldown > 0}
                      style={{
                        padding: '0 16px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: resendCooldown > 0 ? '#68736B' : '#12372A',
                        backgroundColor: resendCooldown > 0 ? '#E5E9E4' : '#F8CB46',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: '10px',
                        cursor: resendCooldown > 0 || otpPhase === 'SENDING' ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {otpPhase === 'SENDING' ? (
                        <>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            border: '2px solid rgba(18,55,42,0.3)',
                            borderTop: '2px solid #12372A',
                            borderRadius: '50%',
                            animation: 'spin 0.6s linear infinite'
                          }} />
                          Sending OTP...
                        </>
                      ) : resendCooldown > 0 ? (
                        <>
                          <Clock size={13} />
                          Resend ({resendCooldown}s)
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          {otpPhase === 'SENT' ? 'Resend Code' : 'Verify Mobile'}
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResetPhone}
                      title="Change mobile number"
                      style={{
                        padding: '0 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#68736B',
                        backgroundColor: '#F7F8F5',
                        border: '1.5px solid #E5E9E4',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <RotateCcw size={13} /> Change
                    </button>
                  )}
                </div>

                {errors.phone && <div style={{ fontSize: '11px', color: '#DC3545', marginTop: '3px' }}>{errors.phone}</div>}

                {/* STATE: Enter Mobile Number helper text */}
                {otpPhase === 'IDLE' && !isMobileVerified && (
                  <div style={{ fontSize: '11.5px', color: '#68736B', marginTop: '5px' }}>
                    Enter mobile number to receive a 6-digit verification code.
                  </div>
                )}

                {/* STATE: Sending OTP indicator */}
                {otpPhase === 'SENDING' && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#FEF9C3',
                    borderRadius: '8px',
                    border: '1px solid #FDE047',
                    fontSize: '12px',
                    color: '#854D0E',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid rgba(133,77,14,0.3)',
                      borderTop: '2px solid #854D0E',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite'
                    }} />
                    Dispatching verification code via SMS to your mobile...
                  </div>
                )}

                {/* STATE: Mobile Number Verified Confirmation Card */}
                {isMobileVerified && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 14px',
                    backgroundColor: '#F0FDF4',
                    borderRadius: '10px',
                    border: '1px solid #86EFAC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} color="#168A45" />
                      <span style={{ fontSize: '12.5px', color: '#166534', fontWeight: 600 }}>
                        Mobile number <strong style={{ color: '#14532D' }}>{maskPhoneNumber(phone)}</strong> successfully verified!
                      </span>
                    </div>
                  </div>
                )}

                {/* SPECIFIC ERROR STATE: SMS Delivery Failure */}
                {otpErrorType === 'SMS_FAILURE' && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 12px',
                    backgroundColor: '#FEF2F2',
                    borderRadius: '8px',
                    border: '1px solid #FCA5A5',
                    color: '#991B1B',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <strong>SMS Delivery Failed:</strong> {otpErrorMessage || 'Unable to deliver verification code. Please check your number or try again later.'}
                    </div>
                  </div>
                )}

                {/* SPECIFIC ERROR STATE: Too Many Attempts */}
                {otpErrorType === 'TOO_MANY_ATTEMPTS' && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 12px',
                    backgroundColor: '#FEF2F2',
                    borderRadius: '8px',
                    border: '1px solid #FCA5A5',
                    color: '#991B1B',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ flex: 1 }}>
                      <strong>Too Many Attempts:</strong> {otpErrorMessage || 'Verification attempt limit reached. Please request a new code.'}
                      <div style={{ marginTop: '6px' }}>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={resendCooldown > 0}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#B91C1C',
                            textDecoration: 'underline',
                            fontWeight: 700,
                            padding: 0,
                            cursor: 'pointer',
                            fontSize: '11.5px'
                          }}
                        >
                          Request New Verification Code
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* OTP VERIFICATION TRAY (States: OTP sent, Enter verification code, Verifying OTP, OTP expired, Invalid OTP) */}
                {otpPhase !== 'IDLE' && !isMobileVerified && (
                  <div style={{
                    marginTop: '10px',
                    padding: '14px 16px',
                    backgroundColor: '#FAFDFB',
                    borderRadius: '12px',
                    border: '1.5px solid #BBF7D0',
                    boxShadow: '0 4px 12px rgba(22, 138, 69, 0.08)'
                  }}>
                    {/* STATE: OTP Sent & Masked Mobile Number Display */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '12.5px', color: '#168A45', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <CheckCircle2 size={14} /> OTP Sent Successfully!
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#68736B', marginTop: '2px' }}>
                          Enter the 6-digit verification code sent to <strong style={{ color: '#17211B' }}>{maskPhoneNumber(phone)}</strong>:
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#68736B', backgroundColor: '#E8F5ED', padding: '2px 6px', borderRadius: '4px' }}>
                        Expires in 5 min
                      </span>
                    </div>

                    {/* Code input + Confirm button */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        id="signup-otp-input"
                        type="text"
                        maxLength={6}
                        placeholder="••••••"
                        value={otpCode}
                        disabled={otpPhase === 'VERIFYING'}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setOtpCode(val);
                          if (otpErrorType === 'INVALID') {
                            setOtpErrorType(null);
                            setOtpErrorMessage('');
                          }
                        }}
                        style={{
                          width: '130px',
                          padding: '8px 12px',
                          fontFamily: 'monospace',
                          fontSize: '16px',
                          fontWeight: 800,
                          textAlign: 'center',
                          letterSpacing: '4px',
                          color: '#17211B',
                          background: '#FFFFFF',
                          border: `1.5px solid ${otpErrorType ? '#DC3545' : '#168A45'}`,
                          borderRadius: '8px',
                          outline: 'none'
                        }}
                      />

                      <button
                        id="btn-confirm-otp"
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={otpPhase === 'VERIFYING' || otpCode.length < 6}
                        style={{
                          padding: '9px 16px',
                          backgroundColor: otpCode.length === 6 ? '#168A45' : '#9AA39D',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: otpCode.length === 6 && otpPhase !== 'VERIFYING' ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* STATE: Verifying OTP */}
                        {otpPhase === 'VERIFYING' ? (
                          <>
                            <div style={{
                              width: '12px',
                              height: '12px',
                              border: '2px solid rgba(255,255,255,0.4)',
                              borderTop: '2px solid #FFFFFF',
                              borderRadius: '50%',
                              animation: 'spin 0.6s linear infinite'
                            }} />
                            Verifying OTP...
                          </>
                        ) : (
                          <>
                            <Check size={14} /> Confirm Code
                          </>
                        )}
                      </button>

                      {/* Resend Link */}
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={resendCooldown > 0 || otpPhase === 'VERIFYING'}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: resendCooldown > 0 ? '#9AA39D' : '#168A45',
                          cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                          textDecoration: 'underline',
                          padding: '4px 6px',
                          marginLeft: 'auto'
                        }}
                      >
                        {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
                      </button>
                    </div>

                    {/* SPECIFIC ERROR STATE: OTP Expired */}
                    {otpErrorType === 'EXPIRED' && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 10px',
                        backgroundColor: '#FEF3C7',
                        border: '1px solid #FCD34D',
                        borderRadius: '6px',
                        color: '#92400E',
                        fontSize: '11.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} />
                          <span><strong>OTP Expired:</strong> The code has expired. Please request a new code.</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          style={{
                            background: '#B45309',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Request New Code
                        </button>
                      </div>
                    )}

                    {/* SPECIFIC ERROR STATE: Invalid OTP */}
                    {otpErrorType === 'INVALID' && (
                      <div style={{
                        marginTop: '8px',
                        fontSize: '11.5px',
                        color: '#DC3545',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <AlertCircle size={14} />
                        <span>
                          <strong>Invalid OTP:</strong> {otpErrorMessage || 'Incorrect verification code. Please check SMS and try again.'}
                          {remainingAttempts !== null && remainingAttempts > 0 && ` (${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} left)`}
                        </span>
                      </div>
                    )}

                    {/* General Error within Tray */}
                    {otpErrorType === 'GENERAL' && otpErrorMessage && (
                      <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#DC3545' }}>
                        {otpErrorMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Email Address (Optional) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#17211B', marginBottom: '5px' }}>
                  Email Address <span style={{ color: '#68736B', fontWeight: 500 }}>(Optional)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#68736B' }}>
                    <Mail size={16} />
                  </div>
                  <input
                    id="signup-email"
                    type="email"
                    placeholder="operator@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: null });
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px 10px 38px',
                      fontSize: '13.5px',
                      fontFamily: 'inherit',
                      color: '#17211B',
                      background: '#F7F8F5',
                      border: `1.5px solid ${errors.email ? '#DC3545' : '#E5E9E4'}`,
                      borderRadius: '10px',
                      outline: 'none'
                    }}
                  />
                </div>
                {errors.email && <div style={{ fontSize: '11px', color: '#DC3545', marginTop: '3px' }}>{errors.email}</div>}
              </div>

              {/* Employment Type & Department (2-Column Grid) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {/* Employment Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#17211B', marginBottom: '5px' }}>
                    Employment Type <span style={{ color: '#DC3545' }}>*</span>
                  </label>
                  <select
                    id="signup-employment-type"
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      color: '#17211B',
                      background: '#F7F8F5',
                      border: '1.5px solid #E5E9E4',
                      borderRadius: '10px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="FULL_TIME">Full-Time (WMS)</option>
                    <option value="PART_TIME">Part-Time (Flex)</option>
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#17211B', marginBottom: '5px' }}>
                    Department
                  </label>
                  <select
                    id="signup-department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      color: '#17211B',
                      background: '#F7F8F5',
                      border: '1.5px solid #E5E9E4',
                      borderRadius: '10px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#17211B' }}>
                    Password <span style={{ color: '#DC3545' }}>*</span>
                  </label>
                  {password && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: strength.color }}>
                      {strength.text}
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#68736B' }}>
                    <Lock size={16} />
                  </div>
                  <input
                    id="signup-password"
                    type="password"
                    required
                    placeholder="Min. 8 characters (letters + numbers)"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({ ...errors, password: null });
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px 10px 38px',
                      fontSize: '13.5px',
                      fontFamily: 'inherit',
                      color: '#17211B',
                      background: '#F7F8F5',
                      border: `1.5px solid ${errors.password ? '#DC3545' : '#E5E9E4'}`,
                      borderRadius: '10px',
                      outline: 'none'
                    }}
                  />
                </div>
                {errors.password && <div style={{ fontSize: '11px', color: '#DC3545', marginTop: '3px' }}>{errors.password}</div>}
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#17211B', marginBottom: '5px' }}>
                  Confirm Password <span style={{ color: '#DC3545' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#68736B' }}>
                    <Lock size={16} />
                  </div>
                  <input
                    id="signup-confirm-password"
                    type="password"
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null });
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px 10px 38px',
                      fontSize: '13.5px',
                      fontFamily: 'inherit',
                      color: '#17211B',
                      background: '#F7F8F5',
                      border: `1.5px solid ${errors.confirmPassword ? '#DC3545' : '#E5E9E4'}`,
                      borderRadius: '10px',
                      outline: 'none'
                    }}
                  />
                </div>
                {errors.confirmPassword && <div style={{ fontSize: '11px', color: '#DC3545', marginTop: '3px' }}>{errors.confirmPassword}</div>}
              </div>

              {/* Create Account Button (Disabled until Mobile Verification Succeeds) */}
              <button
                id="signup-submit"
                type="submit"
                disabled={!isMobileVerified || loading}
                style={{
                  width: '100%',
                  padding: '13px',
                  fontSize: '14px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  color: '#FFFFFF',
                  background: !isMobileVerified
                    ? '#A0A7A2'
                    : loading
                    ? '#68736B'
                    : '#168A45',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: !isMobileVerified || loading ? 'not-allowed' : 'pointer',
                  boxShadow: !isMobileVerified || loading ? 'none' : '0 4px 14px rgba(22, 138, 69, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
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
                    Submitting Application...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Create Employee Account
                  </>
                )}
              </button>

              {/* Mandatory Mobile Verification Helper Notice */}
              {!isMobileVerified && (
                <div style={{
                  textAlign: 'center',
                  marginTop: '10px',
                  fontSize: '11.5px',
                  color: '#68736B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}>
                  <AlertCircle size={13} color="#D97706" />
                  <span>Mobile OTP verification is mandatory before account registration can be submitted.</span>
                </div>
              )}
            </form>

            {/* Back to Login link */}
            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#68736B' }}>
              <span>Already registered? </span>
              <Link
                to="/login"
                style={{
                  color: '#168A45',
                  fontWeight: 700,
                  textDecoration: 'underline'
                }}
              >
                Log in to Terminal
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
