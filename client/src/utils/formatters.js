/**
 * Formats a role string for display.
 * Converts snake_case role identifiers to proper English labels.
 * @param {string} role - The raw role string (e.g., 'club_member')
 * @returns {string} Formatted role label (e.g., 'Club Member')
 */
export function formatRole(role) {
  const roleMap = {
    admin: 'Admin',
    photographer: 'Photographer',
    club_member: 'Club Member',
    viewer: 'Viewer',
  };
  return roleMap[role] || role || 'Unknown';
}
