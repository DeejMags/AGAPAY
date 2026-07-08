function splitName(value) {
  if (!value) return { firstName: '', lastName: '' };
  const text = String(value).trim();
  if (!text) return { firstName: '', lastName: '' };

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function normalizeEmailLocalPart(email) {
  if (!email) return '';
  const raw = String(email).trim().toLowerCase();
  if (!raw) return '';
  const [localPart] = raw.split('@');
  return (localPart || '').replace(/[._-]+/g, ' ').trim();
}

function buildUserNameData(input = {}) {
  const firstNameInput = String(input.firstName || '').trim();
  const lastNameInput = String(input.lastName || '').trim();
  const singleNameInput = String(input.name || input.username || input.displayName || input.fullName || '').trim();
  const email = String(input.email || '').trim();

  const firstName = firstNameInput || (singleNameInput ? splitName(singleNameInput).firstName : '');
  const lastName = lastNameInput || (singleNameInput ? splitName(singleNameInput).lastName : '');
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || singleNameInput || normalizeEmailLocalPart(email);
  const displayName = fullName || normalizeEmailLocalPart(email);
  const username = fullName || displayName;

  return {
    firstName: firstName || '',
    lastName: lastName || '',
    fullName,
    displayName,
    username,
  };
}

module.exports = {
  buildUserNameData,
  splitName,
  normalizeEmailLocalPart,
};
