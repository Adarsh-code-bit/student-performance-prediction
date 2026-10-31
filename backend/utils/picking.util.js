/**
 * Picking & Location Guidance Utilities
 * Quick Commerce Smart Inventory Management System
 */

/**
 * Formats full rack-level location string without inventing identifiers.
 * Only non-empty attributes are included.
 * If location is absent, returns "Location not assigned".
 */
function formatLocationDisplay(location) {
  if (!location || typeof location !== 'object') {
    return {
      text: 'Location not assigned',
      isAssigned: false,
      parts: {}
    };
  }

  const clean = (val) => {
    if (val == null) return null;
    const str = String(val).trim();
    return str.length > 0 ? str : null;
  };

  const parts = {
    zone: clean(location.zone),
    aisle: clean(location.aisle),
    rack: clean(location.rack_number || location.rack),
    shelf: clean(location.shelf),
    bin: clean(location.bin),
    location_name: clean(location.location_name)
  };

  const hasAny = Object.values(parts).some(v => v !== null);
  if (!hasAny) {
    return {
      text: 'Location not assigned',
      isAssigned: false,
      parts: {}
    };
  }

  const segments = [];
  if (parts.aisle) segments.push(`Aisle: ${parts.aisle}`);
  if (parts.rack) segments.push(`Rack: ${parts.rack}`);
  if (parts.shelf) segments.push(`Shelf: ${parts.shelf}`);
  if (parts.bin) segments.push(`Bin: ${parts.bin}`);
  if (parts.zone) segments.push(`Zone: ${parts.zone}`);

  const formattedText = segments.length > 0 
    ? segments.join(' | ') 
    : (parts.location_name || 'Location not assigned');

  return {
    text: formattedText,
    isAssigned: true,
    parts
  };
}

/**
 * Calculates durations in seconds from server-generated timestamps.
 * Accepts optional referenceTime for deterministic testing.
 */
function calculatePickingDurations(task, referenceTime = new Date()) {
  const now = referenceTime;

  // Waiting time: time between assignment and picking start
  let waitingSeconds = 0;
  if (task.picking_assigned_at && task.picking_started_at) {
    waitingSeconds = Math.max(0, Math.floor((new Date(task.picking_started_at) - new Date(task.picking_assigned_at)) / 1000));
  } else if (task.picking_assigned_at && !task.picking_started_at) {
    waitingSeconds = Math.max(0, Math.floor((now - new Date(task.picking_assigned_at)) / 1000));
  }

  // Total elapsed duration: from picking start to now (or completion)
  let totalElapsedSeconds = 0;
  if (task.picking_started_at) {
    const end = task.picked_at ? new Date(task.picked_at) : now;
    totalElapsedSeconds = Math.max(0, Math.floor((end - new Date(task.picking_started_at)) / 1000));
  }

  return {
    waitingSeconds,
    totalElapsedSeconds
  };
}

/**
 * Formats duration in seconds into human-readable MM:SS or HH:MM:SS
 */
function formatDuration(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

module.exports = {
  formatLocationDisplay,
  calculatePickingDurations,
  formatDuration
};
