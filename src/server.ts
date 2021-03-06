import { Db } from "mongodb";
import * as core from "express-serve-static-core";
import express from "express";
import mongoSession from "connect-mongo";
import * as gamesController from "./controllers/games.controller";
import * as nunjucks from "nunjucks";
import * as platformsController from "./controllers/platforms.controller";
import GameModel, { Game } from "./models/gameModel";
import PlatformModel, { Platform } from "./models/platformModel";
import bodyParser from "body-parser";
import session from "express-session";
import OAuth2Client, { OAuth2ClientConstructor } from "@fwl/oauth2";
import * as dotenv from "dotenv";

dotenv.config();
const clientWantsJson = (request: express.Request): boolean => request.get("accept") === "application/json";
const jsonParser = bodyParser.json();
const formParser = bodyParser.urlencoded({ extended: true });

export function  makeApp(db: Db): core.Express {
  const app = express();

  nunjucks.configure("views", {
    autoescape: true,
    express: app,
  });

  const mongoStore = mongoSession(session);
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  
const sessionParser = session({
    secret: process.env.CLIENT_SECRET || "",
    name: "sessionId",
    resave: false,
    saveUninitialized: true,
    store: new mongoStore({
      client: Db,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      expires: new Date(Date.now() + 3600000),
  },
});

  app.use("/assets", express.static("public"));
  app.set("view engine", "njk");

  const platformModel = new PlatformModel(db.collection<Platform>("platforms"));
  const gameModel = new GameModel(db.collection<Game>("games"));

  // Authentification module
  const oauthClientConstructorProps: OAuth2ClientConstructor = {
    openIDConfigurationURL: "https://fewlines.connect.prod.fewlines.tech/.well-known/openid-configuration",
    clientID: process.env.CLIENT_ID || "",
    clientSecret: process.env.CLIENT_SECRET || "",
    redirectURI: "http://localhost:8080/oauth/callback",
    audience: process.env.AUDIENCE || "",
    scopes: ["openid", "email"],
  };


  const oauthClient = new OAuth2Client(oauthClientConstructorProps);

  console.log(oauthClient);

  app.get("/", async (_request, response) => {
    const param = (await oauthClient.getAuthorizationURL()).toString();
    response.render("/layout/index", { param });
  });

  /*
  app.get("/oauth/callback", sessionParser, (_request, response) => {

  })
*/
  //// End of authentification module

  app.get("/api", (_request, response) => response.render("pages/api"));
  app.get("/", (_request, response) => response.render("pages/home"));
  app.get("/platforms", platformsController.index(platformModel));
  app.get("/platforms/new", platformsController.newPlatform());
  app.get("/platforms/:slug", platformsController.show(platformModel));
  app.get("/platforms/:slug/edit", platformsController.edit(platformModel));
  app.post("/platforms", jsonParser, formParser, platformsController.create(platformModel));
  app.put("/platforms/:slug", jsonParser, platformsController.update(platformModel));
  app.post("/platforms/:slug", formParser, platformsController.update(platformModel));
  app.delete("/platforms/:slug", jsonParser, platformsController.destroy(platformModel));

  app.get("/platforms/:slug/games", gamesController.list(gameModel));
  app.get("/games", gamesController.index(gameModel));
  app.get("/games/new", gamesController.newGame());
  app.get("/games/:slug", gamesController.show(gameModel));
  app.get("/games/:slug/edit", gamesController.edit(gameModel));
  app.post("/games", jsonParser, formParser, gamesController.create(gameModel, platformModel));
  app.put("/games/:slug", jsonParser, gamesController.update(gameModel, platformModel));
  app.post("/games/:slug", formParser, gamesController.update(gameModel, platformModel));
  app.delete("/games/:slug", jsonParser, gamesController.destroy(gameModel));

  app.get("/*", (request, response) => {
    console.log(request.path);
    if (clientWantsJson(request)) {
      response.status(404).json({ error: "Not Found" });
    } else {
      response.status(404).render("pages/not-found");
    }
  });

  return app;
}

