// src/utils/client.ts
import axios from "axios";
import logger from "./logger.js";

/**
 * Utility function for testing cancellation
 * Makes a request to the specified endpoint and cancels it after a timeout
 */
export const makeAndCancelRequest = async (url: string, cancelAfterMs = 2000): Promise<void> => {
  // Create cancellation token
  const controller = new AbortController();
  const { signal } = controller;
  
  // Set up cancellation after specified delay
  const timeoutId = setTimeout(() => {
    logger.info(`Cancelling request to ${url} after ${cancelAfterMs}ms`);
    controller.abort();
  }, cancelAfterMs);
  
  try {
    logger.info(`Making request to ${url}`);
    const response = await axios.get(url, { signal });
    clearTimeout(timeoutId);
    logger.info("Request completed successfully", response.data);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError" || error.name === "CanceledError") {
      logger.info("Request was cancelled by the client as expected");
    } else {
      logger.error("Error during request:", error);
    }
  }
};
