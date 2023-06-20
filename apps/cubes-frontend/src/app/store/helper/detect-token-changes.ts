import { ListOfOwnedTokens } from "../../openapi-client";
import { MintActions } from "../mint.actions";

/**
 * Detect changes between two states of owned and lended tokens.
 *
 * This function is used to identify the changes between two states of owned and lended tokens
 * and determine what actions should be dispatched based on these changes.
 * This function works by identifying the differences between the old and new states of both owned and lended tokens.
 * Based on these differences, it generates an array of actions that correspond to the detected changes.
 * These actions can then be dispatched to update the global state accordingly.
 *
 * The following situations are supported:
 *
 *    1. User mints or buys one or more tokens, the tokens are now in the array of owned tokens
 *    2. User sends one or more token away or sells it, they are not any longer his token so they are not lended or owned anymore.
 *    3. User lends one or more token to somebody else, the tokens are removed from the  array of owned tokens and added to the array of lended tokens
 *    4. User retrieves one or more loaned token, the tokens are removed from the  array of loaned tokens and added to the array of owned tokens
 *
 * @param {ListOfOwnedTokens} prevState - The previous state of owned and lended tokens.
 * @param {ListOfOwnedTokens} newState - The new state of owned and lended tokens.
 * @returns {Array} - Array of actions to be dispatched.
 */
export function detectTokenChanges(prevState: ListOfOwnedTokens, newState: ListOfOwnedTokens) {

  // Get the list of tokens that are in the new state's owned tokens but not in the previous state's owned or lended tokens.
  // This represents tokens that have been minted or bought.
  const mintedOrBoughtTokens = newState.owned.filter(
    token => !prevState.owned.find(t => t.tokenId === token.tokenId) && !prevState.lended.find(t => t.tokenId === token.tokenId)
  );

  // Get the list of tokens that are in the previous state's owned tokens but not in the new state's owned or lended tokens.
  // This represents tokens that have been sent or sold.
  const sentOrSoldTokens = prevState.owned.filter(
    token => !newState.owned.find(t => t.tokenId === token.tokenId) && !newState.lended.find(t => t.tokenId === token.tokenId)
  );

  // Get the list of tokens that are in the new state's lended tokens but not in the previous state's lended tokens.
  // This represents tokens that have been loaned.
  const loanedTokens = newState.lended.filter(
    token => !prevState.lended.find(t => t.tokenId === token.tokenId)
  );

  // Get the list of tokens that are in the previous state's lended tokens but not in the new state's lended tokens.
  // This represents tokens that have been retrieved from loan.
  const retrievedTokens = prevState.lended.filter(
    token => !newState.lended.find(t => t.tokenId === token.tokenId)
  );

  const actions = [];

  // If there are any minted or bought tokens, create an action for them and add it to the actions array.
  if (mintedOrBoughtTokens.length > 0) {
    actions.push(MintActions.tokensMintedOrBought({ tokens: mintedOrBoughtTokens }));
  }

  // If there are any sent or sold tokens, create an action for them and add it to the actions array.
  if (sentOrSoldTokens.length > 0) {
    actions.push(MintActions.tokensSentOrSold({ tokens: sentOrSoldTokens }));
  }

  // If there are any loaned tokens, create an action for them and add it to the actions array.
  if (loanedTokens.length > 0) {
    actions.push(MintActions.tokensLoaned({ tokens: loanedTokens }));
  }

  // If there are any retrieved tokens, create an action for them and add it to the actions array.
  if (retrievedTokens.length > 0) {
    actions.push(MintActions.loanedTokensRetrieved({ tokens: retrievedTokens }));
  }

  return actions;
}
