import pino from 'pino';

// Create base Pino logger
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

// Wrapper to maintain Winston-like API compatibility
const logger = {
  info: (message: string, meta?: object) => {
    if (meta) {
      pinoLogger.info(meta, message);
    } else {
      pinoLogger.info(message);
    }
  },
  error: (message: string, meta?: object) => {
    if (meta) {
      pinoLogger.error(meta, message);
    } else {
      pinoLogger.error(message);
    }
  },
  warn: (message: string, meta?: object) => {
    if (meta) {
      pinoLogger.warn(meta, message);
    } else {
      pinoLogger.warn(message);
    }
  },
  debug: (message: string, meta?: object) => {
    if (meta) {
      pinoLogger.debug(meta, message);
    } else {
      pinoLogger.debug(message);
    }
  },
};

export default logger;