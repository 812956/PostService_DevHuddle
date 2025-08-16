"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
const logger_util_1 = __importDefault(require("../utils/logger.util"));
class BaseRepository {
    constructor(model) {
        this.model = model;
    }
    async findById(id) {
        try {
            return await this.model.findUnique({ where: { id } });
        }
        catch (error) {
            logger_util_1.default.error(`Error finding entity by id: ${id}`, {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async findOne(where) {
        try {
            return await this.model.findFirst({ where });
        }
        catch (error) {
            logger_util_1.default.error("Error finding entity", { error: error.message });
            throw new Error("Database error");
        }
    }
    async create(data) {
        try {
            return await this.model.create({ data });
        }
        catch (error) {
            logger_util_1.default.error("Error creating entity", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async update(id, data) {
        try {
            return await this.model.update({
                where: { id },
                data,
            });
        }
        catch (error) {
            logger_util_1.default.error(`Error updating entity: ${id}`, {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async delete(id) {
        try {
            await this.model.delete({ where: { id } });
        }
        catch (error) {
            logger_util_1.default.error(`Error deleting entity: ${id}`, {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async updateWhere(where, data) {
        try {
            return await this.model.update({ where, data });
        }
        catch (error) {
            logger_util_1.default.error("Error updating entity by criteria", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
}
exports.BaseRepository = BaseRepository;
