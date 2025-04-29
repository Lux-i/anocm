import { RedisClientType } from "redis";
import { randomUUID, UUID } from "crypto";
import { DatabaseTypes } from "@anocm/shared/dist";


export class Database {
    redis;
    client: RedisClientType;

    constructor() {
        this.redis = require("redis");
        this.client = this.redis.createClient({
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            socket: {
                host: 'redis-18414.c293.eu-central-1-1.ec2.redns.redis-cloud.com',
                port: 18414
            }
        });

        this.client.on('error', (err: Error) => console.log("Redis client error: ", err));
        this.client.connect();
        this.client.exists('total_users').then((data: number) => {
            if (!data) {
                this.client.set('total_users', '0');
            }
        });

        console.debug("Loaded DB");
    }

    getRandomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min) + min);
    }

    /**
     * Creates Chat with the Users in the User Array
     * @param {User} user
     * @returns chatId
     */
    async createChat(users: DatabaseTypes.User[]): Promise<UUID | false> {
        if (users.length >= 2) {
            let chatId = randomUUID();
            for (const user of users) {
                if (!(await this.client.exists(`user:${user.userId}`))) {
                    if (!(await this.client.exists(`anon_user:${user.userId}`))) {
                        return false;
                    }
                }
            }
            for (const user of users) {
                await this.client.hSet(`chat:${chatId}:users`, `${user.userId}`, `member`);
            }

            await this.client.hSet(`chat:${chatId}:users`, `${users.at(0)?.userId}`, "admin");

            await this.client.hSet(`chat:${chatId}:settings`, {
                'admin': `${users.at(0)?.userId}`,
            });

            return chatId;
        }else{
            return false;
        }
    }

    async sendMessageToChat(chatId: string, senderId: string, message: string): Promise<boolean>{
        try{
            const timestamp = Date.now();
            const messageObj = {
                from: senderId,
                message: message,
            };
            await this.client.hSet(`chat:${chatId}:messages`, timestamp.toString(), JSON.stringify(messageObj));
            return true;
        }catch{
            return false;
        }
    }

    async getChatMessages(chatId: string): Promise <DatabaseTypes.messageStructure | false>{

        if((await this.client.EXISTS(`chat:${chatId}:messages`))){
        try{            
            const response = await this.client.hGetAll(`chat:${chatId}:messages`);
            //console.log(response);
            const convertedResponse : DatabaseTypes.messageStructure = {};

            for(let [key, msg] of Object.entries(response)){
                const parsedMessage : DatabaseTypes.ChatMessage = JSON.parse(msg);
                const parsedKey: EpochTimeStamp = Number(key);
                convertedResponse[parsedKey] = parsedMessage;
            }
            return convertedResponse;
        }catch{
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
    async createUser(username: string, password: string): Promise<UUID | false> {

        if (((typeof username != undefined) && (typeof password != undefined)) && ((username != "") && (password != ""))) {
            let cursor = 0;

            do {
                const scanResult = await this.client.scan(cursor, {
                    MATCH: 'user:*',
                    COUNT: 100,
                });

                cursor = Number(scanResult.cursor);
                const keys = scanResult.keys;

                for (const key of keys) {
                    const searchResult = await this.client.hGet(key, 'username');
                    if (searchResult == username) {
                        return false;
                    }
                }

            } while (cursor !== 0);

            let userId: UUID = randomUUID();
            await this.client.hSet(`user:${userId}`, {
                username: `${username}`,
                password: `${password}`,
            });
            return userId;
        }
        return false;
    }

    /**
     * Creates anonymous User key-value string that has the clientId
     * @returns clientId
     */
    async createAnoUser(): Promise<string> {
        let userId: string = randomUUID();
        let clientId: string = randomUUID();
        await this.client.hSet(`user:${userId}`, {
            UUID: `${userId}`,
        });
        return clientId;
    }

    async getChat(chatIdInput: string): Promise<DatabaseTypes.Chat | false> {
        try {
            const chat: DatabaseTypes.Chat = {
                chatId: chatIdInput,
                chatUserList: await this.client.hGetAll(`chat:${chatIdInput}:users`),
                chatSettings: await this.client.hGetAll(`chat:${chatIdInput}:settings`),
                chatMessages: await this.client.hGetAll(`chat:${chatIdInput}:messages`),
            }

            return chat;
        } catch {
            return false;
        }
    }

    async addUsertoChat(chatId: UUID, userId: UUID): Promise<boolean> {
        if ((await this.client.exists(`user:${userId}`)) && !(await this.client.HEXISTS(`chat:${chatId}:users`, `${userId}`))) {
            if (await this.client.hSet(`chat:${chatId}:users`, `${userId}`, "member")) {
                return true;
            }
        } else {
            return false;
        }
        return false;
    }

    async deleteUserFromChat(chatId: UUID, userId: UUID): Promise<boolean> {
        if ((await this.client.exists(`user:${userId}`)) && (await this.client.HEXISTS(`chat:${chatId}:users`, `${userId}`))) {
            if (await this.client.hDel(`chat:${chatId}:users`, `${userId}`)) {
                return true;
            }
        } else {
            return false;
        }
        return false;
    }

}


