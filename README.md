# Big Mongorepo

* https://genesis.haushoppe.art/  (Cloudflare Pages)
* https://backend.haushoppe.art/  (Koyeb)
  * Internal URL: https://backend-teamkow593gppp.koyeb.app/
* https://assets.haushoppe.art/  (Cloudflare Pages)

Unfinished projects:
* https://scales-dashboard.theangelswing.art/  (Cloudflare Pages)
* https://cube-threejs-test-build.pages.dev/  (Cloudflare Pages)


## Setup

This project was developed with Node v16. Newer version should work fine, too.  
Copy `.env.example` to `.env` and adjust the config values.

Install all npm deps:

```
npm install
```

To make the developer experience nicer,
you may want to install the Nx CLI globally.  
But this is optional:

```
npm install -g nx
```


## Assets

Are in a different repo, hosted on Cloudflare Pages:

https://github.com/haushoppe/assets

For local development, clone the repo and run a simple webserver like this:

```
cd assets
npx http-server -o
```

This will open a webserver on http://localhost:8080/ .


## Howto

Start all apps and also the test ethereum network with test data:

```
npm run start
```

Only start backend (API) in dev mode:

```
npm run start:backend 
```

Only start Genesis Frontend (Angular App) in dev mode:

```
npm run start:genesis-frontend
``` 


## Infrastructure

### Database (TODO, right now unused)

* [MongoDB Atlas](https://www.mongodb.com/cloud)

### Ethereum contracts

* see extra [REAMDE](contracts/README.md)


# Extra stuff

### ⭐️ z_extra/testmint

Ethspresso deployed a first testnet contract:

* 99 pre-generated (?) metadata-files, all pointing to the same URL
* https://testnets.opensea.io/collection/rotatingcube
* see
    * `testmint/animation_url` (static html)
    * `testmint/contract` (not verified on etherscan!)
    * `testmint/metadata` (example 0-10)
* TODO: contract, instructions how to deploy, etc...

### ⭐️ z_extra/prototypes/threejs-test

First working concept of the new rotating cube. Without any blockchain stuff.

### ⭐️ z_extra/prototypes/webgl-2012

Johannes has been in the topic 10 years before, and has pretty much forgotten it all again. Let's see how we make this cube look really glamorous with modern libraries.

* see `prototypes/webgl-2012`
* hint: start with a real webserver, eg `npx http-server`


# TODO Chats

* https://chat.blockscan.com/apis --> https://backend.haushoppe.art/chat/webhook
* Kendo Chat + Twilio?
  * https://www.telerik.com/kendo-angular-ui/components/conversational-ui/
  * https://www.twilio.com/docs/conversations/javascript/exploring-conversations-javascript-quickstart
