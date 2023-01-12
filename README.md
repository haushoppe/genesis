# Big Mongorepo

This project was generated using [Nx](https://nx.dev).

## Setup

Copy `.env.example` to `.env` and adjust the config values.

To make the developer experience nicer,
you may want to install the Nx CLI globally.  
But this is optional:

```
npm install -g nx
```

## Howto

Start backend (API) in dev mode:

```
npm run start:backend 
```

Start Frontend (Angular App) in dev mode:

```
npm run start:scales-dashboard-frontend
``` 

Start all

```
npm run start
```

## Infrastructure



### Database

* [MongoDB Atlas](https://www.mongodb.com/cloud)

### Backend API (TODO - get rid of Render!)

* https://scales-dashboard-backend.onrender.com
* [Nest.js](https://nestjs.com/) (on top of [Express](https://expressjs.com/)) Webserver in a [Nx](https://nx.dev/) workspace
* Automatically build and deployed from `main` branch
* Free Plan on Render.com

Web services on the free plan are automatically spun down after 15 minutes of inactivity. When a new request for a free service comes in, Render spins it up again so it can process the request. This can cause a response delay of up to 30 seconds for the first request that comes in after a period of inactivity. More info [here](https://render.com/docs/free#free-web-services).

### Scales Frontend (TODO)

* https://scales-dashboard.theangelswing.art/
* [Angular](https://angular.io/) app in a [Nx](https://nx.dev/) workspace





# The default branch has been renamed!

`master` is now named `main`

If you have a local clone, you can update it by running the following commands.

```
git branch -m master main
git fetch origin
git branch -u origin/main main
git remote set-head origin -a
```
