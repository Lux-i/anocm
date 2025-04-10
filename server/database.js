"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomInt = getRandomInt;
exports.createChat = createChat;
exports.createUser = createUser;
exports.createAnoUser = createAnoUser;
//Math.randon() => 0 - 1
// * n => 0 - n
// + m => m - n+m
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}
/**
 *
 * @param {import("redis").RedisClientType} client
 * @returns
 */
function createChat(client) {
    return __awaiter(this, void 0, void 0, function* () {
        let chatId = getRandomInt(0, 1000);
        yield client.lPush(chatId.toString(), '');
        return chatId;
    });
}
function createUser(client, username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        let userId = yield client.incr('total_users');
        yield client.hSet(`user:${userId}`, {
            username: `${username}`,
            password: `${password}`,
        });
        return userId;
    });
}
function createAnoUser(client) {
    return __awaiter(this, void 0, void 0, function* () {
        let userId = yield client.incr('total_users');
        let clientId = getRandomInt(1000, 9000);
        yield client.set(`user:${userId}`, clientId.toString());
        return clientId;
    });
}
