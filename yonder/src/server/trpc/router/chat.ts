import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { db } from '../../../lib/db';
import { chatsTable, messagesTable, organizationsTable, membersTable } from '../../../lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import type { Message } from 'ai';

export const chatRouter = router({
  // Create a new chat
  createChat: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      title: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(and(
          eq(membersTable.userId, ctx.user.id),
          eq(membersTable.organizationId, input.organizationId)
        ))
        .limit(1);

      if (!membership) {
        throw new Error('You are not a member of this organization');
      }

      const [chat] = await db.insert(chatsTable).values({
        organizationId: input.organizationId,
        createdBy: ctx.user.id,
        title: input.title || 'New Chat',
      }).returning();

      return chat;
    }),

  // Get all chats for the current user's active organization
  getUserChats: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(and(
          eq(membersTable.userId, ctx.user.id),
          eq(membersTable.organizationId, input.organizationId)
        ))
        .limit(1);

      if (!membership) {
        throw new Error('You are not a member of this organization');
      }

      const { page, limit } = input;
      const offset = (page - 1) * limit;

      // Get total count
      const [{ count }] = await db
        .select({ count: sql`count(*)`.as('count') })
        .from(chatsTable)
        .where(eq(chatsTable.organizationId, input.organizationId));

      // Get paginated chats
      const chats = await db
        .select()
        .from(chatsTable)
        .where(eq(chatsTable.organizationId, input.organizationId))
        .orderBy(desc(chatsTable.updatedAt))
        .limit(limit)
        .offset(offset);

      const totalCount = Number(count) || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        chats,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    }),

  // Get a specific chat with messages
  getChat: protectedProcedure
    .input(z.object({
      chatId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Get chat and verify user has access through organization membership
      const [chatData] = await db
        .select({
          chat: chatsTable,
          organization: organizationsTable,
        })
        .from(chatsTable)
        .innerJoin(organizationsTable, eq(chatsTable.organizationId, organizationsTable.id))
        .innerJoin(membersTable, and(
          eq(membersTable.organizationId, organizationsTable.id),
          eq(membersTable.userId, ctx.user.id)
        ))
        .where(eq(chatsTable.id, input.chatId))
        .limit(1);

      if (!chatData) {
        throw new Error('Chat not found or you do not have access');
      }

      // Get messages for this chat
      const messages = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.chatId, input.chatId))
        .orderBy(messagesTable.createdAt);

      // Return ONLY the pure AI SDK messages from JSONB - no database metadata mixed in
      const pureAIMessages = messages.map(msg => msg.message);

      return {
        chat: chatData.chat,
        organization: chatData.organization,
        messages: pureAIMessages,
      };
    }),

  // Save messages to a chat
  saveMessages: protectedProcedure
    .input(z.object({
      chatId: z.string(),
      messages: z.array(z.any()), // Accept any message structure from AI SDK
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify chat access through organization membership
      const [chatData] = await db
        .select({
          chat: chatsTable,
        })
        .from(chatsTable)
        .innerJoin(membersTable, and(
          eq(membersTable.organizationId, chatsTable.organizationId),
          eq(membersTable.userId, ctx.user.id)
        ))
        .where(eq(chatsTable.id, input.chatId))
        .limit(1);

      if (!chatData) {
        throw new Error('Chat not found or you do not have access');
      }

      // Get existing message IDs to avoid duplicates
      const existingMessages = await db
        .select({ message: messagesTable.message })
        .from(messagesTable)
        .where(eq(messagesTable.chatId, input.chatId));

      const existingIds = new Set(existingMessages.map(m => (m.message as Message)?.id));

      // Filter out messages that already exist
      const newMessages = input.messages.filter(msg => !existingIds.has(msg.id));

      if (newMessages.length > 0) {
        // Insert new messages - store complete message as JSONB
        await db.insert(messagesTable).values(
          newMessages.map(msg => ({
            id: crypto.randomUUID(),
            chatId: input.chatId,
            createdBy: ctx.user.id,
            message: msg, // Store complete message as JSONB
            createdAt: new Date(),
          }))
        );

        // Update chat's updatedAt timestamp
        await db
          .update(chatsTable)
          .set({ updatedAt: new Date() })
          .where(eq(chatsTable.id, input.chatId));
      }

      return { success: true, savedCount: newMessages.length };
    }),

  // Update chat title
  updateChatTitle: protectedProcedure
    .input(z.object({
      chatId: z.string(),
      title: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify chat access through organization membership
      const [updatedChat] = await db
        .update(chatsTable)
        .set({ 
          title: input.title,
          updatedAt: new Date(),
        })
        .from(chatsTable)
        .innerJoin(membersTable, and(
          eq(membersTable.organizationId, chatsTable.organizationId),
          eq(membersTable.userId, ctx.user.id)
        ))
        .where(eq(chatsTable.id, input.chatId))
        .returning();

      if (!updatedChat) {
        throw new Error('Chat not found or you do not have access');
      }

      return updatedChat;
    }),

  // Delete a chat
  deleteChat: protectedProcedure
    .input(z.object({
      chatId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify chat access through organization membership
      const [chatToDelete] = await db
        .select({ id: chatsTable.id })
        .from(chatsTable)
        .innerJoin(membersTable, and(
          eq(membersTable.organizationId, chatsTable.organizationId),
          eq(membersTable.userId, ctx.user.id)
        ))
        .where(eq(chatsTable.id, input.chatId))
        .limit(1);

      if (!chatToDelete) {
        throw new Error('Chat not found or you do not have access');
      }

      const result = await db
        .delete(chatsTable)
        .where(eq(chatsTable.id, input.chatId))
        .returning();

      if (result.length === 0) {
        throw new Error('Failed to delete chat');
      }

      return { success: true };
    }),
}); 