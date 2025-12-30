const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {

    }
  },
  warn: (...args: any[]) => {
    if (isDev) {

    }
  },
  error: (...args: any[]) => {

  },
  info: (...args: any[]) => {
    if (isDev) {

    }
  },
  debug: (...args: any[]) => {
    if (isDev) {

    }
  },
};

