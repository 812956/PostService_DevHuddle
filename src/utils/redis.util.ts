import { createClient } from "redis";
import logger from "./logger.util";

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => {
  logger.error("Redis Client Error", { error: err.message });
});

redisClient.on("connect",()=> {
    logger.info("redis connected")
})

export const connectRedis = async ()=> {
    if(!redisClient.isOpen) {
       await redisClient.connect()
    }
}

export const generateBlockUserRedisKey = (sensitive:string):string=> {
 return `blacklist:user:${sensitive}`
}

export default redisClient