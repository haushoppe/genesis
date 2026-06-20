export const environment = {
  production: true,
  api: 'https://backend.haushoppe.art',
  ordinalsExplorerIframe: 'https://explorer.ordinalsbot.com/content/',
  ordinalsExplorerDetails: 'https://ordinals.com/inscription/',
  // ord.net IS a marketplace (not just an explorer like ordinals.com) AND it
  // renders every inscription, listed or not — so the link works for every
  // cube. Note: ord.net's URLs use the inscription NUMBER, not the ID
  // (id → number is a 308 redirect on their side, but we save the hop by
  // passing the number directly).
  ordinalsExplorerMarketplace: 'https://ord.net/inscription/'
};
