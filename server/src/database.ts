import { RedisClientType } from "redis";

//Math.randon() => 0 - 1
// * n => 0 - n
// + m => m - n+m

export function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) + min);
}


/**
 * 
 * @param {import("redis").RedisClientType} client 
 * @returns 
 */
export async function createChat(client: RedisClientType){
    let chatId = getRandomInt(0, 1000);
    await client.lPush(chatId.toString(), '');
    return chatId;
}



export async function createUser(client: RedisClientType, username: string, password: string): Promise<number>{
    let userId: number = await client.incr('total_users');
    await client.hSet(`user:${userId}`, {
        username: `${username}`,
        password: `${password}`,
      });
      return userId;
}

export async function createAnoUser(client: RedisClientType): Promise<number> {
    let userId: number = await client.incr('total_users');
    let clientId: number = getRandomInt(1000, 9000);
    await client.set(`user:${userId}`, clientId.toString());
    return clientId;
}