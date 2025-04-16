import { RedisClientType } from "redis";

export class Database{
    redis;
    client: RedisClientType;

    constructor() {
        this.redis = require("redis");
        this.client = this.redis.createClient();
        this.client.on('error', (err: Error) => console.log("Redis client error: ", err));
        this.client.connect();
        this.client.exists('total_users').then((data: number) => {
            if(!data){
                this.client.set('total_users','0');
            }
            console.log(data);
        });
    }

    getRandomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min) + min);
    }
    
    /**
     * 
     * @param {import("redis").RedisClientType} client 
     * @returns 
     */
    async createChat(): Promise<number>{
        let chatId = this.getRandomInt(0, 1000);
        await this.client.lPush(chatId.toString(), '');
        return chatId;
    }

    async createUser(username: string, password: string): Promise<number>{
        let userId: number = await this.client.incr('total_users');
        await this.client.hSet(`user:${userId}`, {
            username: `${username}`,
            password: `${password}`,
          });
          return userId;
    }

    async createAnoUser(): Promise<number> {
        let userId: number = await this.client.incr('total_users');
        let clientId: number = this.getRandomInt(1000, 9000);
        await this.client.set(`user:${userId}`, clientId.toString());
        return clientId;
    }
}





