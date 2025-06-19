import { Request, Response } from "express";
import { Database } from "../../modules/database/database";
import { DatabaseResponse, Chat } from "@anocm/shared/dist";

const express = require("express");
const router = express.Router();

import { UUID } from "crypto";

function instanceOfChat(object: any): object is Chat {
    return "chatId" in object;
}

export default () => {
    router.post("/newchat", async (req: Request, res: Response) => {
        console.log("POST Request: new Chat");
        try {
            Database.createChat(req.body.userList, req.body.ttl, req.body.minTTL, req.body.maxTTL, req.body.creatorId, req.body.creatorToken).then((chatId: UUID | false) => {
                if (chatId != false) {
                    const response: DatabaseResponse = {
                        success: true,
                        id: chatId.toString(),
                    };
                    res.send(response);
                } else {
                    const response: DatabaseResponse = {
                        success: false,
                        error: `Error creating Chat`,
                    };
                    res.send(response);
                }
            });
        } catch (err: any) {
            const response: DatabaseResponse = {
                success: false,
                error: err,
            };
            res.send(response);
            console.error("Error creating new Chat: ", err);
        }
    });

    router.get("/getchat", async (req: Request, res: Response) => {
        try {
            const chatId = req.query.chatid as string;
            const token = req.query.token as string;
            const userId = req.query.userid as string;

            if (!chatId || !token || !userId) {
                return res.status(400).json({
                    success: false,
                    error: "Missing parameters in query.",
                });
            }

            Database.getChat(chatId, userId, token).then((chat: Chat | any) => {
                if(instanceOfChat(chat)){
                    const response: DatabaseResponse = {
                        success: true,
                        userData: chat,
                    };
                    res.send(response);
                }else{
                    const response: DatabaseResponse = {
                        success: false,
                        userData: chat,
                    };
                    res.send(response);
                }
            });
        } catch (err: any) {
            const response: DatabaseResponse = {
                success: false,
                error: err,
            };
            res.send(response);
        }
    });

    router.get("/getChatSettings", async (req: Request, res: Response) => {
        try {
            const chatId = req.query.chatid as UUID;
            const token = req.query.token as UUID;
            const userId = req.query.userid as UUID;

            if (!chatId || !token || !userId) {
                return res.status(400).json({
                    success: false,
                    error: "Missing parameters in query.",
                });
            }

            Database.getChatSettings(chatId, userId, token).then((chat: Chat | any) => {
                if(instanceOfChat(chat)){
                    const response: DatabaseResponse = {
                        success: true,
                        userData: chat,
                    };
                    res.send(response);
                }else{
                    const response: DatabaseResponse = {
                        success: false,
                        userData: chat,
                    };
                    res.send(response);
                }
            });
        } catch (err: any) {
            const response: DatabaseResponse = {
                success: false,
                error: err,
            };
            res.send(response);
        }
    });

    router.post("/adduser", async (req: Request, res: Response) => {
        console.log("POST Request: add User to Chat");
        try {
            Database.addUsertoChat(req.body.chatId, req.body.userId, req.body.adminId, req.body.adminToken).then(
                (response: boolean) => {
                    if (response == true) {
                        const response: DatabaseResponse = {
                            success: true,
                        };
                        res.send(response);
                    } else {
                        const response: DatabaseResponse = {
                            success: false,
                            error: `Error adding User`,
                        };
                        res.send(response);
                    }
                }
            );
        } catch (err: any) {
            const response: DatabaseResponse = {
                success: false,
                error: err,
            };
            res.send(response);
            console.error("Error adding User: ", err);
        }
    });
    router.post("/remuser", async (req: Request, res: Response) => {
        console.log("POST Request: remove User from Chat");
        try {
            Database.deleteUserFromChat(req.body.chatId, req.body.userId, req.body.adminId, req.body.adminToken).then(
                (response: boolean) => {
                    if (response == true) {
                        const response: DatabaseResponse = {
                            success: true,
                        };
                        res.send(response);
                    } else {
                        const response: DatabaseResponse = {
                            success: false,
                            error: `Error removing User`,
                        };
                        res.send(response);
                    }
                }
            );
        } catch (err: any) {
            const response: DatabaseResponse = {
                success: false,
                error: err,
            };
            res.send(response);
            console.error("Error adding User: ", err);
        }
    });
    
    interface Message {
        chatID: string,
        senderID: string,
        senderToken: string,
        content: string,
        timestamp: string,
        ttl?: number,
    }

    router.post("/send_message", async (req: Request, res: Response) =>{
        console.log("send message");
        try{
            const data: Message = req.body;
            if(await Database.checkUserinChat(data.chatID, data.senderID)){
                Database.sendMessageToChat(data.chatID, data.senderID, data.senderToken,data.content, data.timestamp, data.ttl).then(databaseResponse => {
                    if(databaseResponse == true){
                        const response: DatabaseResponse = {
                            success: true,
                        };
                        res.send(response);
                    }else{
                        const response: DatabaseResponse = {
                            success: false,
                            error: databaseResponse,
                        };
                        res.send(response);
                    }
                });
            }else{
                const response: DatabaseResponse = {
                    success: false,
                    error: `Sender is not in Chat!`,
                };
                res.send(response);
            }
        }catch(err: any){
            const response: DatabaseResponse = {
                success: false,
                error: err,
            };
            res.send(response);
            console.error("Error sending message: ", err);
        }
    });

    return router;
};
