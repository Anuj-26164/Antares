import { create } from 'zustand';

const MAX_ACTIVITIES = 50;

const useActivityStore = create((set) => ({
  list: [],

  addActivity: (activity) => {
    set((state) => ({
      list: [activity, ...state.list].slice(0, MAX_ACTIVITIES),
    }));
  },
}));

export default useActivityStore;
