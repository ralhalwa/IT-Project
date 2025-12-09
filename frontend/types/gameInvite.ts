// src/types/gameInvite.ts

// Prefix stored in the message text
export const GAME_INVITE_PREFIX = "__GAME_INVITE__:" as const;

export type GameInvitePayload = {
  url: string;
  fromId: string;
  toId?: string;
  groupId?: string;
  createdAt: string;
  roomId: string; // 👈 each invite has its own room
};
