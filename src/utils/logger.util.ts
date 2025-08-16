import winston, { format } from "winston"

const logger = winston.createLogger({
    level : process.env.LOG_LEVEL ,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports : [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/auth-service.log' })
    ]
})

export default logger