import { create } from 'zustand';

/**
 * Theme store — always dark mode. No toggle.
 */
function applyThemeToDOM() {
  document.documentElement.classList.add('dark');
}

const useThemeStore = create(() => ({
  theme: 'dark',
}));

// Apply dark mode on module load
applyThemeToDOM();

export { applyThemeToDOM };
export default useThemeStore;
