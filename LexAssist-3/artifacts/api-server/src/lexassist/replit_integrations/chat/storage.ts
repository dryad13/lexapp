import { db } from "../../db";
import { conversations, messages } from "../../../shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: number, organisationId?: number): Promise<typeof conversations.$inferSelect | undefined>;
  getAllConversations(organisationId?: number): Promise<(typeof conversations.$inferSelect)[]>;
  createConversation(title: string, organisationId: number): Promise<typeof conversations.$inferSelect>;
  deleteConversation(id: number, organisationId?: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<(typeof messages.$inferSelect)[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<typeof messages.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number, organisationId?: number) {
    const conditions = [eq(conversations.id, id)];
    if (organisationId != null) conditions.push(eq(conversations.organisationId, organisationId));
    const [conversation] = await db.select().from(conversations).where(and(...conditions));
    return conversation;
  },

  async getAllConversations(organisationId?: number) {
    if (organisationId != null) {
      return db
        .select()
        .from(conversations)
        .where(eq(conversations.organisationId, organisationId))
        .orderBy(desc(conversations.createdAt));
    }
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  },

  async createConversation(title: string, organisationId: number) {
    const [conversation] = await db
      .insert(conversations)
      .values({ title, organisationId })
      .returning();
    return conversation;
  },

  async deleteConversation(id: number, organisationId?: number) {
    const existing = await this.getConversation(id, organisationId);
    if (!existing) return;
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },

  async getMessagesByConversation(conversationId: number) {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const [message] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return message;
  },
};
