function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

/**
 * 
 * @param {import("redis").RedisClientType} client 
 * @returns 
 */
export async function createChat(client){
    let chatId = getRandomInt(1000);
    await client.lPush(chatId.toString(), '');
    return chatId;
}