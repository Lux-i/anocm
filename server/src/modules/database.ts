import { RedisClientType } from "redis";
import { randomUUID } from "crypto";

interface User {
    userId: string,
    username?: string,
}

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
     * Creates Chat with the Users in the User Array
     * @param {User} user
     * @returns chatId
     */
    async createChat(user: User[]): Promise<number>{
        let chatId = this.getRandomInt(0, 10000);
        await this.client.lPush(chatId.toString(), '');
        return chatId;
    }

    /**
     * Creates User hashmap for an user with username and password
     * @param {string} username
     * @param {string} password
     * @returns userId
     */
    async createUser(username: string, password: string): Promise<number>{
        let userId: number = await this.client.incr('total_users');
        await this.client.hSet(`user:${userId}`, {
            username: `${username}`,
            password: `${password}`,
          });
          return userId;
    }

    /**
     * Creates anonymous User key-value string that has the clientId
     * @returns clientId
     */
    async createAnoUser(): Promise<string> {
        let userId: number = await this.client.incr('total_users');
        let clientId: string = randomUUID();
        await this.client.set(`user:${userId}`, clientId.toString());
        return clientId;
    }
}





