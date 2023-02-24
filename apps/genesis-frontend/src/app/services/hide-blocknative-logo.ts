export function hideBlocknativeLogo() {

  const observer = new MutationObserver((mutations: MutationRecord[], obs: MutationObserver) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'ONBOARD-V2') {

            const onboardEl = node as Element;

            const styleElement = document.createElement('template');
            styleElement.innerHTML = `<style>
              .powered-by-container,
              .sidebar > div:nth-child(2) {
                display: none !important;
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
