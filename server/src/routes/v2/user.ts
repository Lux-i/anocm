import { Request, Response } from "express";
import { Database } from "../../modules/database/database";
import { DatabaseResponse, Chat } from "@anocm/shared/dist";

const express = require("express");
const router = express.Router();

export default () => {
    router.post("/newano", async (req: Request, res: Response) => {
        console.log("POST Request: new anonymous User");
        try {
            Database.createAnoUser().then((clientId: string) => {
                const response: DatabaseResponse = {
                    success: true,
                    id: clientId.toString(),
                };
                res.send(response);
            });
        } catch (err: any) {
            const response: DatabaseResponse = {
                success: false,
                error: err,
            };
            res.send(response);
            console.error("Error sending response: ", err);
        }
    });

    router.post("/newuser", async (req: Request, res: Response) => {
        console.log("POST Request: new User");
        try {
            Database.createUser(req.body.username, req.body.password).then(
                (userId: string | false) => {
                    if (userId == false) {
                        const response: DatabaseResponse = {
                            success: false,
                            error: "Error creating User",
                        };
                        res.send(response);
                    } else {
                        const response: DatabaseResponse = {
                            success: true,
                            id: userId.toString(),
                            userData: req.body.username,
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
            console.error("Error sending response: ", err);
        }
    });

    router.post("/login", async (req: Request, res: Response) => {
        console.log("POST Request: new Login");
        try {
            Database.loginUser(req.body.userId_username, req.body.password).then(
                (token: string[] | false) => {
                    if (token == false) {
                        const response: DatabaseResponse = {
                            success: false,
                            error: "Error logging in",
                        };
                        res.send(response);
                    } else {
                        if(token.length == 1){
                            const response: DatabaseResponse = {
                                success: true,
                                id: req.body.userId_username,
                                userData: token[1],
                            };
                            res.send(response);
                        }else{
                            const response: DatabaseResponse = {
                                success: true,
                                id: token[0],
                                userData: token[1],
                            };
                            res.send(response);
                        }
                    }
                }
            );
        } catch (err: any) {
            const response: DatabaseResponse = {
                success: false,
                error: err,
            };
            res.send(response);
            console.error("Error sending response: ", err);
        }
    });
    return router;
};
