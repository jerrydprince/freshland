/**
 * A lightweight, native parser for .ics (iCalendar) files used by OTAs.
 * Extracts Booking references (UIDs), Start Dates, and End Dates.
 */

export const parseICal = (icalText) => {
  const events = [];
  const lines = icalText.split(/\r?\n/);
  
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT') {
      if (currentEvent && currentEvent.checkIn && currentEvent.checkOut) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('UID:')) {
        currentEvent.uid = line.substring(4).trim();
      } else if (line.startsWith('DTSTART')) {
        currentEvent.checkIn = parseIcalDate(line.split(':')[1].trim());
      } else if (line.startsWith('DTEND')) {
        currentEvent.checkOut = parseIcalDate(line.split(':')[1].trim());
      } else if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.substring(8).trim();
      }
    }
  }

  return events;
};

/**
 * Parses iCal date format (YYYYMMDD) into standard YYYY-MM-DD
 */
const parseIcalDate = (dateStr) => {
  if (!dateStr || dateStr.length < 8) return null;
  // Handle '20231024' or '20231024T140000Z'
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
};

/**
 * Generates an iCal file string from an array of bookings.
 */
export const generateICal = (bookings, roomName) => {
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Luxe Apartment PMS//${roomName}//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  bookings.forEach(b => {
    // Convert YYYY-MM-DD to YYYYMMDD
    const checkIn = b.check_in_date.replace(/-/g, '');
    const checkOut = b.check_out_date.replace(/-/g, '');
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    ical.push('BEGIN:VEVENT');
    ical.push(`UID:${b.booking_reference}@luxepms.com`);
    ical.push(`DTSTAMP:${now}`);
    ical.push(`DTSTART;VALUE=DATE:${checkIn}`);
    ical.push(`DTEND;VALUE=DATE:${checkOut}`);
    ical.push(`SUMMARY:Reserved - ${b.booking_source.toUpperCase()}`);
    ical.push('END:VEVENT');
  });

  ical.push('END:VCALENDAR');
  return ical.join('\r\n');
};
