import React from 'react';
import { BellRing, Volume2, VolumeX, Play } from 'lucide-react';

const OrderNotificationAlert = ({
  actionableOrders = [],
  soundEnabled,
  onToggleSound,
  onClaim,
  onSilence,
  isSirenPlaying
}) => {
  if (!actionableOrders || actionableOrders.length === 0) return null;

  const primaryOrder = actionableOrders[0];
  const orderCount = actionableOrders.length;
  const itemCount = primaryOrder.items_count || primaryOrder.items?.length || 1;
  const orderIdentifier = primaryOrder.order_number || `ORD-${primaryOrder.order_id}`;

  return (
    <div 
      className="actionable-order-banner"
      style={{
        backgroundColor: '#12372A',
        color: '#FFFFFF',
        borderRadius: '10px',
        border: '1px solid rgba(248, 203, 70, 0.35)',
        borderLeft: '4px solid #F8CB46',
        padding: '10px 16px',
        marginBottom: '16px',
        boxShadow: '0 4px 16px rgba(18, 55, 42, 0.18)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}
    >
      {/* Left: Icon, Order ID, Items, SLA tag & Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 400px' }}>
        <div 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#0B231B',
            color: '#F8CB46',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'inset 0 0 0 1px rgba(248, 203, 70, 0.25)',
            animation: isSirenPlaying ? 'pulse 1s infinite' : 'none'
          }}
        >
          <BellRing size={18} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span 
              style={{
                backgroundColor: '#F8CB46',
                color: '#12372A',
                fontWeight: 800,
                fontSize: '10px',
                padding: '2px 7px',
                borderRadius: '4px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              Actionable Order
            </span>

            <span style={{ fontWeight: 800, fontSize: '13px', color: '#FFFFFF', fontFamily: 'monospace' }}>
              #{orderIdentifier}
            </span>

            <span style={{ fontSize: '12px', color: '#CBD2CA', fontWeight: 600 }}>
              ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </span>

            <span 
              style={{
                backgroundColor: '#0B231B',
                color: '#F8CB46',
                border: '1px solid rgba(248, 203, 70, 0.4)',
                fontWeight: 800,
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '4px',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap'
              }}
            >
              10-MIN SLA
            </span>

            {orderCount > 1 && (
              <span 
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: '9999px',
                  whiteSpace: 'nowrap'
                }}
              >
                +{orderCount - 1} more in queue
              </span>
            )}
          </div>

          <div style={{ fontSize: '12px', color: '#A2D7B5', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Customer: <strong style={{ color: '#FFFFFF' }}>{primaryOrder.customer_name}</strong>
            {primaryOrder.city && <span> ({primaryOrder.city})</span>}
            <span style={{ opacity: 0.7 }}> • Immediate dark-store picking required.</span>
          </div>
        </div>
      </div>

      {/* Right: Compact Audio Toggle & Primary Claim & Pick Action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
        {/* Compact Sound Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          style={{
            backgroundColor: soundEnabled ? 'rgba(22, 138, 69, 0.25)' : 'rgba(255, 255, 255, 0.08)',
            border: soundEnabled ? '1px solid rgba(22, 138, 69, 0.45)' : '1px solid rgba(255, 255, 255, 0.15)',
            color: soundEnabled ? '#79C395' : '#CBD2CA',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title={soundEnabled ? 'Audio siren active on new orders. Click to mute.' : 'Sound muted. Click to enable sound alerts.'}
        >
          {soundEnabled ? (
            <>
              <Volume2 size={14} color="#79C395" />
              <span>Sound: ON</span>
            </>
          ) : (
            <>
              <VolumeX size={14} color="#CBD2CA" />
              <span>Sound Muted</span>
            </>
          )}
        </button>

        {/* Silence Button (only when actively sounding) */}
        {isSirenPlaying && (
          <button
            type="button"
            onClick={onSilence}
            style={{
              backgroundColor: '#DC3545',
              border: 'none',
              color: '#FFFFFF',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              animation: 'pulse 1s infinite'
            }}
            title="Silence current alert siren"
          >
            <VolumeX size={14} />
            <span>Silence Siren</span>
          </button>
        )}

        {/* Primary Action Button: Claim & Pick */}
        <button
          type="button"
          onClick={() => onClaim(primaryOrder.order_id)}
          style={{
            backgroundColor: '#F8CB46',
            color: '#12372A',
            border: 'none',
            padding: '7px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(248, 203, 70, 0.35)',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#D4A418';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = '#F8CB46';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <Play size={13} fill="currentColor" />
          <span>Claim & Pick #{orderIdentifier}</span>
        </button>
      </div>
    </div>
  );
};

export default OrderNotificationAlert;
