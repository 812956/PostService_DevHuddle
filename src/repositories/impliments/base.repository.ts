import logger from "../../utils/logger.util";

export abstract class BaseRepository<
  TModel extends {
    findUnique: Function;
    findFirst: Function;
    create: Function;
    update: Function;
    delete: Function;
  },
  Entity,
  CreateInput,
  UpdateInput,  
  WhereUniqueInput  
> {
  protected model: TModel;

  constructor(model: TModel) {
    this.model = model;
  }

  async findById(id: string): Promise<Entity | null> {
    try {
      return await this.model.findUnique({ where: { id } as WhereUniqueInput });
    } catch (error) {
      logger.error(`Error finding entity by id: ${id}`, {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async findOne(where: Partial<Entity>): Promise<Entity | null> {
    try {
      return await this.model.findFirst({ where });
    } catch (error) {
      logger.error("Error finding entity", { error: (error as Error).message });
      throw new Error("Database error");
    }
  }

  async create(data: Partial<CreateInput>): Promise<Entity> {
    try {
      return await this.model.create({ data });
    } catch (error) {
      logger.error("Error creating entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async update(id: string, data: UpdateInput): Promise<Entity> {
    try {
      return await this.model.update({
        where: { id } as WhereUniqueInput,
        data,
      });
    } catch (error) {
      logger.error(`Error updating entity: ${id}`, {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.model.delete({ where: { id } as WhereUniqueInput });
    } catch (error) {
      logger.error(`Error deleting entity: ${id}`, {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async updateWhere(
    where: WhereUniqueInput,
    data: UpdateInput
  ): Promise<Entity> {
    try {
      return await this.model.update({ where, data });
    } catch (error) {
      logger.error("Error updating entity by criteria", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }
}
