export const storage = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {

      return null;
    }
  },

  set: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {

    }
  },

  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {

    }
  },

  getJson: <T>(key: string): T | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {

      return null;
    }
  },

  setJson: (key: string, value: any): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {

    }
  }
};