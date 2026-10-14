/**
 * Parser and normalizer for vCard (.vcf) files
 */

export function parseVcfContent(content) {
  const cards = content.split(/BEGIN:VCARD/i).slice(1);
  const contacts = [];
  const seenNumbers = new Set();

  for (const card of cards) {
    let name = '';
    const nameMatch = card.match(/FN(?:;[^:]*)?:(.*)/i) || card.match(/N(?:;[^:]*)?:(.*)/i);
    if (nameMatch) {
      name = nameMatch[1].replace(/;/g, ' ').trim();
    }

    // Match all TEL properties
    const telRegex = /TEL(?:;[^:]*)?:([^\r\n]+)/gi;
    let match;
    while ((match = telRegex.exec(card)) !== null) {
      const rawNumber = match[1].trim();
      const cleanNumber = normalizePhoneNumber(rawNumber);

      if (cleanNumber && !seenNumbers.has(cleanNumber)) {
        seenNumbers.add(cleanNumber);
        contacts.push({
          name: name || 'بدون اسم',
          rawNumber,
          cleanNumber,
          jid: `${cleanNumber}@s.whatsapp.net`
        });
      }
    }
  }

  return {
    totalParsed: seenNumbers.size,
    contacts,
  };
}

/**
 * Clean and normalize phone number into standard digits-only format
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return null;
  // Remove spaces, hyphens, parentheses, plus signs
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');

  // Remove leading zeros if present before country code (e.g. 002010... -> 2010...)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // Basic validation: must be digits only and length between 8 and 16 digits
  if (!/^\d{8,16}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}
