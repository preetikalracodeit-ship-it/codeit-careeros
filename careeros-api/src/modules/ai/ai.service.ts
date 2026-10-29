import { AppError } from "../../lib/errors.js";
import { getNextSequence } from "../../models/Counter.js";
import { AiChatSession, type AiChatSessionDoc } from "../../models/AiChatSession.js";
import { AiChatMessage, type AiChatMessageDoc } from "../../models/AiChatMessage.js";
import { generateGuidance } from "./ai.guidance.js";

const DEFAULT_TITLE = "New conversation";

function sessionResponse(session: AiChatSessionDoc) {
  return {
    id: session._id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function messageResponse(message: AiChatMessageDoc) {
  return {
    id: message._id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  };
}

export function aiStatus() {
  return {
    configured: false,
    provider: "careeros",
    model: "offline-smart",
    offlineFallback: true,
    mode: "offline-smart",
  };
}

export async function listSessions(userId: number) {
  const sessions = await AiChatSession.find({ userId }).sort({ updatedAt: -1 }).lean();
  return sessions.map((session) => sessionResponse(session as AiChatSessionDoc));
}

export async function createSession(userId: number, title?: string) {
  const id = await getNextSequence("ai_chat_sessions");
  const session = await AiChatSession.create({
    _id: id,
    userId,
    title: title?.trim() || DEFAULT_TITLE,
  });
  return sessionResponse(session.toObject() as AiChatSessionDoc);
}

async function requireSession(userId: number, sessionId: number) {
  const session = await AiChatSession.findOne({ _id: sessionId, userId });
  if (!session) throw AppError.notFound("Conversation not found");
  return session;
}

export async function getHistory(userId: number, sessionId: number) {
  await requireSession(userId, sessionId);
  const messages = await AiChatMessage.find({ sessionId, userId }).sort({ createdAt: 1, _id: 1 }).lean();
  return messages.map((message) => messageResponse(message as AiChatMessageDoc));
}

export async function sendMessage(userId: number, sessionId: number, message: string) {
  const session = await requireSession(userId, sessionId);
  const previous = await AiChatMessage.find({ sessionId, userId, role: "USER" })
    .sort({ createdAt: -1, _id: -1 })
    .limit(6)
    .lean();
  const history = previous.reverse().map((row) => row.content);

  const userMessage = await AiChatMessage.create({
    _id: await getNextSequence("ai_chat_messages"),
    sessionId,
    userId,
    role: "USER",
    content: message,
  });

  let reply: string;
  let toolsUsed: string[];
  try {
    const result = await generateGuidance(userId, message, history);
    reply = result.reply;
    toolsUsed = result.toolsUsed;
  } catch {
    reply = "I could not reach your CareerOS data just now. Please try again in a moment.";
    toolsUsed = [];
  }

  await AiChatMessage.create({
    _id: await getNextSequence("ai_chat_messages"),
    sessionId,
    userId,
    role: "ASSISTANT",
    content: reply,
  });

  session.updatedAt = new Date();
  if (session.title === DEFAULT_TITLE && userMessage.content) {
    session.title = userMessage.content.length > 60 ? `${userMessage.content.slice(0, 57)}...` : userMessage.content;
  }
  await session.save();

  return {
    sessionId,
    reply,
    toolsUsed,
    offline: true,
    mode: "offline-smart",
  };
}

export async function deleteSession(userId: number, sessionId: number) {
  const session = await AiChatSession.findOne({ _id: sessionId, userId });
  if (!session) throw AppError.notFound("Conversation not found");
  await AiChatMessage.deleteMany({ sessionId, userId });
  await session.deleteOne();
  return null;
}
