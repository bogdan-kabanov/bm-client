export const safeLocalStorage = {
  getItem: <T = string>(key: string, defaultValue: T | null = null): T | null => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      return defaultValue;
    }
  },

  setItem: <T>(key: string, value: T): boolean => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  },

  getString: (key: string, defaultValue: string | null = null): string | null => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      return localStorage.getItem(key) || defaultValue;
    } catch (error) {
      return defaultValue;
    }
  },

  setString: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  },
};

