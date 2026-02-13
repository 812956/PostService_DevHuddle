import CircuitBreaker from "opossum";
import logger from "./logger.util";

// Default options for the circuit breaker
const defaultOptions: CircuitBreaker.Options = {
    timeout: 5000, // If function takes longer than 5 seconds, trigger failure
    errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
    resetTimeout: 30000, // After 30 seconds, try again (half-open state)
    rollingCountTimeout: 10000, // Time window to calculate error percentage
    rollingCountBuckets: 10, // Number of buckets for stats
};

/**
 * Creates a circuit breaker for a specific function.
 * @param action The async function to wrap (e.g., the gRPC call)
 * @param name A descriptive name for metrics and logging
 * @param options Custom options to override defaults
 */
export const createCircuitBreaker = <TArgs extends any[], TResult>(
    action: (...args: TArgs) => Promise<TResult>,
    name: string,
    options: CircuitBreaker.Options = {}
): CircuitBreaker<TArgs, TResult> => {
    const breaker = new CircuitBreaker(action, {
        ...defaultOptions,
        ...options,
        name,
    });

    // Logging events
    breaker.on("open", () => {
        logger.warn(`🔴 Circuit Breaker OPEN: ${name} - Service is unavailable`);
    });

    breaker.on("halfOpen", () => {
        logger.info(`🟡 Circuit Breaker HALF-OPEN: ${name} - Testing service recovery`);
    });

    breaker.on("close", () => {
        logger.info(`🟢 Circuit Breaker CLOSED: ${name} - Service recovered`);
    });

    breaker.on("fallback", (result) => {
        logger.warn(`⚠️ Circuit Breaker FALLBACK: ${name} - Using fallback mechanism`);
    });

    breaker.on("failure", (error) => {
        logger.error(`❌ Circuit Breaker FAILURE: ${name}`, {
            error: error.message,
        });
    });

    return breaker;
};

