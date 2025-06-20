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
            if((await client.ttl(`user:${user.userId}`)) != -1){
              await client.hExpire(`chat:${chatId}:users`, `${user.userId}`, (await client.ttl(`user:${user.userId}`)));
            }
          }
        }else{
          for (const user of users) {
            await client.hSet(`chat:${chatId}:users`, `${user.userId}`, `member`);
            if((await client.ttl(`user:${user.userId}`)) != -1){
              await client.hExpire(`chat:${chatId}:users`, `${user.userId}`, (await client.ttl(`user:${user.userId}`)));
            }
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
  ) : Promise<boolean | -1> {
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
    senderToken: string,
    message: string,
    timestamp: number,
    ttl?: number,
  ): Promise<boolean | any> {
    try {

      if(!(await checkUserinChat(chatId, senderId))){
        console.log("not in chat");
        
        throw Error("Client doesnt exist in chat");
      }

      let minTTL = parseInt(await client.hGet(`chat:${chatId}:settings`, `minTTL`) ?? "0");
      let maxTTL = parseInt(await client.hGet(`chat:${chatId}:settings`, `maxTTL`) ?? "0");

      if(ttl && (ttl < minTTL || ttl > maxTTL)){
        console.log("invalid");
        
        throw RangeError("Time to live is invalid")
      }

      const messageObj = {
        senderID: senderId,
        content: message,
      };
      await client.hSet(
        `chat:${chatId}:messages`,
        timestamp,
        JSON.stringify(messageObj)
      );

      let defaultMessageTTL = await client.hGet(`chat:${chatId}:settings`, "defaultMessageTTL");

      if (ttl) {
        await client.hExpire(`chat:${chatId}:messages`, `${timestamp}`, ttl);
      }else if(parseInt(defaultMessageTTL!) != -1){
        await client.hExpire(`chat:${chatId}:messages`, `${timestamp}`, parseInt(defaultMessageTTL!));
      }
      let msg: WsMessage = {
        action: Action.BroadcastToChat,
        content: message,
        senderID: senderId as UUID,
        senderToken: senderToken,
        chatID: chatId as UUID,
        timestamp: Number(timestamp)
      }

      broadcastToChat(msg);
      return true;
    } catch(ex) {
      return ex;
    }
  }

  /**
   * Retrieves all messages from a chat
   * @param {string} chatId - Chat identifier
   * @returns {Promise<messageStructure | false>} Messages object or false
   */
  export async function getChatMessages(
    chatId: string,
    userId: UUID,
    userToken: string,
  ): Promise<messageStructure | false> {
    if(!(await verifyUser(userId, userToken)) || !(await checkUserinChat(chatId, userId))){
      console.log(userToken);
      console.log(userId);
      console.log("no no");
      
      return false;
    }

    if (await client.EXISTS(`chat:${chatId}:messages`)) {
      try {
        const response = await client.hGetAll(`chat:${chatId}:messages`);
        //console.log(response);
        const convertedResponse: messageStructure = {};

        for (let [key, msg] of Object.entries(response)) {
          const parsedKey: EpochTimeStamp = Number(key);

          const rawMessage = typeof msg === "string" ? JSON.parse(msg) : msg;

          const parsedMessage: ChatMessage = {
            senderId: rawMessage.senderID,
            message: rawMessage.content
          };

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
        console.log(userId_username);
      
          await client.hSet(`user:${userId_username}`, {
            token: `${token}`,
          });
          await client.hExpire(`user:${userId_username}`, `token`, 345600);
          return [token];
    }else{
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
            if (searchResult == userId_username) {
              let hashPW = await client.hGet(key, "password");
              if((await verifyHash(hashPW!, password))){
                await client.hSet(key, {
                  token: `${token}`,
                });
                console.log(await client.hExpire(key, `token`, 345600));
                let userId = key.replace("user:", "");
                return [userId, token];
              }
            }
          }
        } while (cursor !== 0);
    }
    console.log("user not found");
    
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
    chatIdInput: string,
    adminId: string,
    adminToken: string
  ): Promise<Chat | any> {
    try {
      adminId = adminId.replace("user:", "");
      if(!(await checkAdmin(adminId, adminToken, chatIdInput))){
        
        console.log("Not permitted!");
        
        throw Error("User is not permitted");
      }

      const rawMessages = await client.hGetAll(`chat:${chatIdInput}:messages`);

      const chatMessages = Object.entries(rawMessages).map(([timestamp, msgStr]) => {
        try {
          const parsedMsg = JSON.parse(msgStr);
          return {
            timestamp,
            ...parsedMsg
          };
        } catch {
          return null;
        }
      }).filter(Boolean);

      const chat: Chat = {
        chatId: chatIdInput,
        chatUserList: await client.hGetAll(`chat:${chatIdInput}:users`),
        chatSettings: await client.hGetAll(`chat:${chatIdInput}:settings`),
        chatMessages: chatMessages,
      };

      return chat;
    } catch(ex: any) {
      return ex;
    }
  }

  export async function getChatSettings(
    chatIdInput: UUID,
    adminId: UUID,
    adminToken: UUID
  ): Promise<Chat | false> {
    try {
      if(!(await checkAdmin(adminId, adminToken, chatIdInput))){
        throw Error("User is not permitted");
      }
      const chat: Chat = {
        chatId: chatIdInput,
        chatSettings: await client.hGetAll(`chat:${chatIdInput}:settings`),
      };

      return chat;
    } catch(ex: any) {
      return ex;
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
    userId: UUID,
    adminId: UUID,
    adminToken: UUID
  ): Promise<boolean> {
    if(!(await checkAdmin(adminId, adminToken, chatId))){
      return false;
    }
    if (
      (await client.exists(`user:${userId}`)) &&
      (await client.HEXISTS(`chat:${chatId}:users`, `${userId}`))
    ) {
      if (await client.hDel(`chat:${chatId}:users`, `${userId}`)) {
        if(!(await client.exists(`chat:${chatId}:users`))){
          await client.del(`chat:${chatId}:messages`);
          await client.del(`chat:${chatId}:settings`);
        }
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
      if (!hash || typeof hash !== "string" || hash.trim() === "") {
        
        console.error("verifyHash: Hash is empty or undefined");
      return false;
    }

      if (await argon2.verify(hash, password)) {
        console.log("verified!");
        
        return true;
      } else {
        console.log("wrong password!");
        
        return false;
      }
    } catch (err) {
      console.error("Hash verify error:", err);
      return false;
    }
  }

  export async function verifyUser(userId: string, token: string): Promise<boolean>{
    const savedToken = await client.hGet(`user:${userId}`, "token");
    if(savedToken == token){
      return true;
    }
    return false;
  }

  export async function checkAdmin(userId: string, token: string, chatId: string): Promise<boolean>{
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
