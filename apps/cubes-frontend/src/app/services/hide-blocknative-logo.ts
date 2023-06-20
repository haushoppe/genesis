export function hideBlocknativeLogo() {

  const observer = new MutationObserver((mutations: MutationRecord[], obs: MutationObserver) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'ONBOARD-V2') {

            const onboardEl = node as Element;

            const styleElement = document.createElement('template');
            styleElement.innerHTML = `<style>
               /* hide: blocknative logo */
              .powered-by-container,
              .sidebar > div:nth-child(2) > svg,
              .sidebar > div:nth-child(3) > svg,

              /* hide: I don't have a wallet */
              .sidebar a,

              /* hide: "Connect another Wallet" / "Disconnect all Wallets" */
              div.action-container,

              /* hide: "Add Account" */
              ul.menu > li:nth-child(1)
              {
                display: none !important;
              }

              /* and while we are here, fix the missing border for the menu */
              ul.menu
              {
                border: 1px solid #d3d3d3 !important;
                box-shadow: rgba(0, 0, 0, 0.2) 0px 4px 16px 0px;
              }

            </style>`;


            if (onboardEl.shadowRoot) {
              onboardEl.shadowRoot.appendChild(styleElement.content);
              obs.disconnect();
            }
          }
        });
      }
    }
  });

  // Start observing the target node for configured mutations
  observer.observe( document, { childList: true, subtree: true });

}
