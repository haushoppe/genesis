import { Metadata } from "../../openapi-client";
import { MintActions } from "../mint.actions";
import { detectTokenChanges } from "./detect-token-changes";

function fakeToken(tokenId: number) {
  return { tokenId } as Metadata;
}

describe('detectTokenChanges', () => {
  it('should detect minted or bought tokens', () => {
    const prevState = {
      owned: [],
      lended: [],
    };

    const newState = {
      owned: [fakeToken(1)],
      lended: [],
    };

    const expectedActions = [
      MintActions.tokensMintedOrBought({ tokens: [fakeToken(1)] }),
    ];

    expect(detectTokenChanges(prevState, newState)).toEqual(expectedActions);
  });

  it('should detect sent or sold tokens', () => {
    const prevState = {
      owned: [fakeToken(1)],
      lended: [],
    };

    const newState = {
      owned: [],
      lended: [],
    };

    const expectedActions = [
      MintActions.tokensSentOrSold({ tokens: [fakeToken(1)] }),
    ];

    expect(detectTokenChanges(prevState, newState)).toEqual(expectedActions);
  });

  it('should detect loaned tokens', () => {
    const prevState = {
      owned: [fakeToken(1)],
      lended: [],
    };

    const newState = {
      owned: [],
      lended: [fakeToken(1)],
    };

    const expectedActions = [
      MintActions.tokensLoaned({ tokens: [fakeToken(1)] }),
    ];

    expect(detectTokenChanges(prevState, newState)).toEqual(expectedActions);
  });

  it('should detect retrieved loaned tokens', () => {
    const prevState = {
      owned: [],
      lended: [fakeToken(1)],
    };

    const newState = {
      owned: [fakeToken(1)],
      lended: [],
    };

    const expectedActions = [
      MintActions.loanedTokensRetrieved({ tokens: [fakeToken(1)] }),
    ];

    expect(detectTokenChanges(prevState, newState)).toEqual(expectedActions);
  });
});
