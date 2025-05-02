import { RedisClientType, createClient } from "redis";
import { randomUUID, UUID } from "crypto";
import { DatabaseTypes } from "@anocm/shared/dist";
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

  export function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
  }

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
   * Creates Chat with the Users in the User Array
   * @returns chatId
   */
  export async function createChat(
    users: DatabaseTypes.User[]
  ): Promise<UUID | false> {
    if (users.length >= 2) {
      let chatId = randomUUID();
      for (const user of users) {
        if (!(await client.exists(`user:${user.userId}`))) {
          if (!(await client.exists(`anon_user:${user.userId}`))) {
            return false;
          }
        }
      }
      for (const user of users) {
        await client.hSet(`chat:${chatId}:users`, `${user.userId}`, `member`);
      }

      await client.hSet(
        `chat:${chatId}:users`,
        `${users.at(0)?.userId}`,
        "admin"
      );

      await client.hSet(`chat:${chatId}:settings`, {
        admin: `${users.at(0)?.userId}`,
      });

      return chatId;
    } else {
      return false;
    }
  }

  export async function sendMessageToChat(
    chatId: string,
    senderId: string,
    message: string
  ): Promise<boolean> {
    try {
      const timestamp = Date.now();
      const messageObj = {
        from: senderId,
        message: message,
      };
      await client.hSet(
        `chat:${chatId}:messages`,
        timestamp.toString(),
        JSON.stringify(messageObj)
      );
      return true;
    } catch {
      return false;
    }
  }

  export async function getChatMessages(
    chatId: string
  ): Promise<DatabaseTypes.messageStructure | false> {
    if (await client.EXISTS(`chat:${chatId}:messages`)) {
      try {
        const response = await client.hGetAll(`chat:${chatId}:messages`);
        //console.log(response);
        const convertedResponse: DatabaseTypes.messageStructure = {};

        for (let [key, msg] of Object.entries(response)) {
          const parsedMessage: DatabaseTypes.ChatMessage = JSON.parse(msg);
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

      try{
      let userId: UUID = randomUUID();
      let hashPW = argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,    // 64 MB
        timeCost: 5,
        parallelism: 1,});

      await client.hSet(`user:${userId}`, {
        username: `${username}`,
        password: `${hashPW}`,
      });
      return userId;

    }catch(err){
        console.error("Error creating user: ", err);
        return false;
    }
    }
    return false;
  }

  /**
   * Creates anonymous User key-value string that has the clientId
   * @returns clientId
   */
  export async function createAnoUser(): Promise<string> {
    let userId: string = randomUUID();
    let clientId: string = randomUUID();
    await client.hSet(`user:${userId}`, {
      UUID: `${userId}`,
    });
    return clientId;
  }

  export async function getChat(
    chatIdInput: string
  ): Promise<DatabaseTypes.Chat | false> {
    try {
      const chat: DatabaseTypes.Chat = {
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

  export async function addUsertoChat(
    chatId: UUID,
    userId: UUID
  ): Promise<boolean> {
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

  export async function verifyHash(hash: string, password: string): Promise<boolean>{
    try{
        if(await argon2.verify(hash, password)){
            return true;
        }else{
            return false;
        }
    }catch(err){
        console.error("Hash verify error:", err);
        return false;
    }
  }
}
