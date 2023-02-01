# Big Mongorepo

* https://genesis.haushoppe.art/
* https://backend.haushoppe.art/
* https://assets.haushoppe.art/

TODO
* https://scales-dashboard.theangelswing.art/
* https://cube-threejs-test-build.pages.dev/


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

Start Genesis Frontend (Angular App) in dev mode:

```
npm run start:genesis-frontend
``` 

Start all

```
npm run start
```

## Infrastructure

### Database

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


# TODO

https://chat.blockscan.com/apis --> https://backend.haushoppe.art/chat/webhook
