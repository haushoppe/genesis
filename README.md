# cube

Home of the cool 3D rotating cube (private repo)


### Static Metadata Page

* This can later be replaced by an API and finally by a directory on IPFS.
* Coudflare pages deploys the directory `static-metadata-page` after every push to the `main` branch
* Static metadata files:
    * https://genesis.haushoppe.art/x/0
    * https://genesis.haushoppe.art/x/1
    * [...]
    * https://genesis.haushoppe.art/x/10


### ⭐️ testmint

Ethspresso deployed a first testnet contract:

* 99 pre-generated (?) metadata-files, all pointing to the same URL
* https://testnets.opensea.io/collection/rotatingcube
* see
    * `testmint/animation_url` (static html)
    * `testmint/contract` (not verified on etherscan!)
    * `testmint/metadata` (example 0-10)
* TODO: contract, instructions how to deploy, etc...


### ⭐️ webgl-2012

Johannes has been in the topic 10 years before, and has pretty much forgotten it all again. Let's see how we make this cube look really glamorous with modern libraries.

* see `prototypes/webgl-2012`
* hint: start with a real webserver, eg `npx http-server`