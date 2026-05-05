/* eslint-disable @typescript-eslint/no-namespace */

import { Encryption } from "../Encryption";

export namespace EncryptionService {
  export async function generateChatKey(chatId: string): Promise<CryptoKey> {
    const newChatKey = await Encryption.generateChatKey();
    await Encryption.storeKey(chatId, newChatKey);
    return newChatKey;
  }

  //possibly rewrite this and .loadKey to throw instead of returning null
  export async function getChatKey(chatId: string): Promise<CryptoKey | null> {
    const chatKey = await Encryption.loadKey(chatId);
    return chatKey;
  }
}
