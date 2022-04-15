# cube

Home of the cool 3D rotating cube (private repo)

**This folder structure is just a first try, feel free to change everything! =)**

---

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