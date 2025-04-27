// src/utils/logger.ts
import pino from "pino";

// Create a shared logger instance
export const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
    },
  },
});

export default logger;
