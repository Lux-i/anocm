import { RedisClientType, createClient } from "redis";
import { randomUUID, UUID } from "crypto";
import { Chat, User, ChatMessage, messageStructure, chatSettings, WsMessage, Action } from "@anocm/shared/dist";
import { broadcastToChat } from "../message/message";
const argon2 = require("argon2");

export namespace Database {
  const client: RedisClientType = createClient({
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    socket: {
      host: "redis-18414.c293.eu-central-1-1.ec2.redns.redis-cloud.com",
      port: 18414,
    },
  });
  /**
   * Returns a random integer between min (inclusive) and max (exclusive)
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (exclusive)
   * @returns {number} Random integer
   */
  export function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
  }

  /**
   * Connects the Redis client and initializes necessary keys
   * @returns {Promise<boolean>} True if connected, false otherwise
   */
  export async function connectClient(): Promise<boolean> {
    client.on("error", (err: Error) => {
      console.log("Redis client error: ", err);
    });

    try {
      client.connect();
    } catch (err) {
      return false;
    }

    client.exists("total_users").then((data: number) => {
      if (!data) {
        client.set("total_users", "0");
      }
    });

    console.debug("Connected to DB");
    return true;
  }

  /**
   * Creates a chat with the given users
   * @param {User[]} users - List of users
   * @returns {Promise<UUID | false>} Chat ID if successful, otherwise false
   */
  export async function createChat(
    users: User[],
    ttl: number,
    minTTL: number,
    maxTTL: number,
    userId: UUID,
    token: UUID
  ): Promise<UUID | false> {
    if(await verifyUser(userId, token)){
      if (users.length >= 2) {
        let chatId = randomUUID();
        for (const user of users) {
          if (!(await client.exists(`user:${user.userId}`))) {
              console.log("User not found");
              return false;
          }
        }
        if(users.length == 2){
          for (const user of users) {
            await client.hSet(`chat:${chatId}:users`, `${user.userId}`, `admin`);
          }
        }else{
          for (const user of users) {
            await client.hSet(`chat:${chatId}:users`, `${user.userId}`, `member`);
          }
          await client.hSet(`chat:${chatId}:users`, `${userId}`, `admin`)
        }
        
        await client.hSet(`chat:${chatId}:settings`, {
          defaultMessageTTL: ttl,
          minMessageTTL: minTTL,
          maxMessageTTL: maxTTL
        });
  
        return chatId;
      } else {
        console.log("Not enough");
        return false;
      }
    }
    return false;
  }

  export async function editChatSettings(
    chatId: UUID,
    newSettings: chatSettings
  ){
    if(newSettings.defaultTTL){
      await client.hSet(`chat:${chatId}:settings`, {
        defaultMessageTTL: newSettings.defaultTTL
      });
    }
    if(newSettings.minTTL){
      await client.hSet(`chat:${chatId}:settings`, {
        minMessageTTL: newSettings.minTTL
      });
    }
    if(newSettings.maxTTL){
      await client.hSet(`chat:${chatId}:settings`, {
        maxMessageTTL: newSettings.maxTTL
      });
    }
  }

  export async function addAdmintoChat(
    newAdmins: User[],
    chatId: UUID,
    adminId: UUID,
    adminToken: UUID
  ){
    if(newAdmins.length < 1){
      return;
    }
    if(!(await checkAdmin(adminId, adminToken, chatId))){
      return;
    }

    for(const newAdmin of newAdmins){
      if(await checkUserinChat(chatId, newAdmin.userId) == false){
        return;
      }
      await client.hSet(`chat:${chatId}:users`, `${newAdmin.userId}`, `admin`);
    }
  }

  export async function removeAdminRole(
    userId: UUID,
    chatId: UUID,
    adminId: UUID,
    adminToken: UUID
  ){
    if((await client.hLen(`chat:${chatId}:users`)) == 2){
      return;
    }
    if(!(await checkAdmin(adminId, adminToken, chatId))){
      return;
    }
    if(await checkUserinChat(chatId, userId) == false){
        return;
    }
      await client.hSet(`chat:${chatId}:users`, `${userId}`, `member`);
    
  }

  export async function checkUserinChat(
    chatId: string,
    userId: string
  ) {
    try {
      if (typeof chatId !== "string" || typeof userId !== "string") {
        throw new TypeError(`Invalid types: chatId=${typeof chatId}, userId=${typeof userId}`);
      }

      console.log(`Checking user in chat with chatId='${chatId}' and userId='${userId}'`);

      let res = await client.hExists(`chat:${chatId}:users`, userId);
      return res;
    } catch (err: any) {
      console.error("Error checking User: ", err);
      return -1;
    }
  }

  /**
   * Sends a message to a specific chat
   * @param {string} chatId - Chat identifier
   * @param {string} senderId - Sender's user ID
   * @param {string} message - Message content
   * @returns {Promise<boolean>} True if sent successfully, false otherwise
   */
  export async function sendMessageToChat(
    chatId: string,
    senderId: string,
    message: string,
    timestamp: string,
    ttl?: number,
  ): Promise<boolean> {
    try {
      const messageObj = {
        from: senderId,
        message: message,
      };
      await client.hSet(
        `chat:${chatId}:messages`,
        timestamp,
        JSON.stringify(messageObj)
      );
      if (ttl) {
        await client.hExpire(`chat:${chatId}:messages`, `${timestamp}`, ttl);
      }

      let msg: WsMessage = {
        action: Action.BroadcastToChat,
        content: message,
        senderID: senderId as UUID,
        chatID: chatId as UUID,
        timestamp: Number(timestamp)
      }

      broadcastToChat(msg);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves all messages from a chat
   * @param {string} chatId - Chat identifier
   * @returns {Promise<messageStructure | false>} Messages object or false
   */
  export async function getChatMessages(
    chatId: string
  ): Promise<messageStructure | false> {
    if (await client.EXISTS(`chat:${chatId}:messages`)) {
      try {
        const response = await client.hGetAll(`chat:${chatId}:messages`);
        //console.log(response);
        const convertedResponse: messageStructure = {};

        for (let [key, msg] of Object.entries(response)) {
          const parsedMessage: ChatMessage = JSON.parse(msg);
          const parsedKey: EpochTimeStamp = Number(key);
          convertedResponse[parsedKey] = parsedMessage;
        }
        return convertedResponse;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Creates User hashmap for an user with username and password
   * @param {string} username
   * @param {string} password
   * @returns userId
   */
  export async function createUser(
    username: string,
    password: string
  ): Promise<UUID | false> {
    if (
      typeof username != undefined &&
      typeof password != undefined &&
      username != "" &&
      password != ""
    ) {
      let cursor = 0;

      do {
        const scanResult = await client.scan(cursor, {
          MATCH: "user:*",
          COUNT: 100,
        });

        cursor = Number(scanResult.cursor);
        const keys = scanResult.keys;

        for (const key of keys) {
          const searchResult = await client.hGet(key, "username");
          if (searchResult == username) {
            return false;
          }
        }
      } while (cursor !== 0);

      try {
        let userId: UUID = randomUUID();
        //Uses argon2id hashing
        let hashPW = await argon2.hash(password, {
          type: argon2.argon2id,
          memoryCost: 2 ** 16,    // 64 MB
          timeCost: 5,
          parallelism: 1,
        });

        await client.hSet(`user:${userId}`, {
          username: `${username}`,
          password: `${hashPW}`,
        });

        return userId;

      } catch (err) {
        console.error("Error creating user: ", err);
        return false;
      }
    }
    return false;
  }

  export async function loginUser(userId_username: UUID | string, password?:string): Promise<string[] | false>{
    
    let token: UUID = randomUUID();

    if(typeof password == "undefined"){
          await client.hSet(`user:${userId_username}`, {
            token: `${token}`,
          });
          await client.hExpire(`user:${userId_username}:messages`, `token`, 345600);
          return [token];
    }else{
      let cursor = 0;
  
        do {
          const scanResult = await client.scan(cursor, {
            MATCH: "user:*",
            COUNT: 1000,
          });
  
          cursor = Number(scanResult.cursor);
          const keys = scanResult.keys;
  
          for (const key of keys) {
            const searchResult = await client.hGet(key, "username");
            if (searchResult == userId_username) {
              let hashPW = await client.hGet(`user:${key}`, "password");
              if((await verifyHash(hashPW!, password))){
                await client.hSet(`user:${userId_username}`, {
                  token: `${token}`,
                });
                await client.hExpire(`user:${key}:messages`, `token`, 345600);
                return [key, token];
              }
            }
          }
        } while (cursor !== 0);
    }
    return false;
  }

  /**
   * Creates an anonymous user hashmap entry
   * @returns {Promise<string>} Client ID
   */
  export async function createAnoUser(): Promise<string> {
    let userId: string = randomUUID();
    //let clientId: string = randomUUID();
    await client.hSet(`user:${userId}`, {
      UUID: `${userId}`,
    });
    await client.expire(`user:${userId}`, 259200);
    return userId;
  }

  /**
   * Retrieves full chat data (users, settings, messages)
   * @param {string} chatIdInput - Chat ID
   * @returns {Promise<Chat | false>} Chat object or false
   */
  export async function getChat(
    chatIdInput: string
  ): Promise<Chat | false> {
    try {
      const chat: Chat = {
        chatId: chatIdInput,
        chatUserList: await client.hGetAll(`chat:${chatIdInput}:users`),
        chatSettings: await client.hGetAll(`chat:${chatIdInput}:settings`),
        chatMessages: await client.hGetAll(`chat:${chatIdInput}:messages`),
      };

      return chat;
    } catch {
      return false;
    }
  }

  /**
 * Adds a user to an existing chat
 * @param {UUID} chatId - Chat ID
 * @param {UUID} userId - User ID to be added
 * @returns {Promise<boolean>} True if added, false otherwise
 */
  export async function addUsertoChat(
    chatId: UUID,
    userId: UUID,
    adminId: UUID,
    adminToken: UUID,
  ): Promise<boolean> {
    if(await checkAdmin(adminId, adminToken, chatId)){
      if (
        (await client.exists(`user:${userId}`)) &&
        !(await client.HEXISTS(`chat:${chatId}:users`, `${userId}`))
      ) {
        if (await client.hSet(`chat:${chatId}:users`, `${userId}`, "member")) {
          return true;
        }
      } else {
        return false;
      }
      return false;
    }
    return false;
  }

  /**
 * Removes a user from a chat
 * @param {UUID} chatId - Chat ID
 * @param {UUID} userId - User ID to be removed
 * @returns {Promise<boolean>} True if removed, false otherwise
 */
  export async function deleteUserFromChat(
    chatId: UUID,
    userId: UUID
  ): Promise<boolean> {
    if (
      (await client.exists(`user:${userId}`)) &&
      (await client.HEXISTS(`chat:${chatId}:users`, `${userId}`))
    ) {
      if (await client.hDel(`chat:${chatId}:users`, `${userId}`)) {
        return true;
      }
    } else {
      return false;
    }
    return false;
  }

  /**
 * Verifies a password against a hash using argon2id
 * @param {string} hash - Hashed password
 * @param {string} password - Plain password
 * @returns {Promise<boolean>} True if match, false otherwise
 */
  export async function verifyHash(hash: string, password: string): Promise<boolean> {
    try {
      if (await argon2.verify(hash, password)) {
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.error("Hash verify error:", err);
      return false;
    }
  }

  export async function verifyUser(userId: UUID, token: UUID): Promise<boolean>{
    const savedToken = await client.hGet(`user:${userId}`, "token");
    if(savedToken == token){
      return true;
    }
    return false;
  }

  export async function checkAdmin(userId: UUID, token: UUID, chatId: UUID): Promise<boolean>{
    if(await verifyUser(userId, token)){
      const userRole = await client.hGet(`chat:${chatId}:users`, `${userId}`);
      if(userRole){
        if(userRole == "admin"){
          return true;
        }
        return false;
      }
    }
    return false;
  }
}
