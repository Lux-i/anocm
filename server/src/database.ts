import { RedisClientType } from "redis";

function getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
}

/**
 * 
 * @param {import("redis").RedisClientType} client 
 * @returns 
 */
export async function createChat(client: RedisClientType){
    let chatId = getRandomInt(1000);
    await client.lPush(chatId.toString(), '');
    return chatId;
}



export async function createUser(client: RedisClientType, username: string, password: string){
    let userId: number = await client.incr('total_users');
    await client.set(username, userId.toString());
    await client.hSet(`user:${userId}`, {
        username: `${username}`,
        password: `${password}`,
      });
}