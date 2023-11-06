import { LooksLikeOrdinalsbotInscription } from '../../../../../shared/ordinalnovus-inscription-search-result';
import { collectClaimedInscriptionIds, sortInscriptions } from './cube-helper';

describe('collectClaimedInscriptionIds', () => {

  it('should collect all IDs based on specified trait types', () => {

    const testData = [
      {
        "inscriptionId": "78fa9d6e9b2b49fbb9f4838e1792dba7c1ec836f22e3206561e2d52759708251i0",
        "meta": {
          "name": "Ordinal Cube #27 (Johannes x Sylvo, September 12)",
          "attributes": [
            {
              "trait_type": "Side 1",
              "value": "6622a6fadba7d22ed333c1dbd0b557b1910a977308c4bcb3cab1e68209f31201i0"
            },
            {
              "trait_type": "Side 2",
              "value": "570a331886dbaa51d3c2997d9d52dad282b91b01e64e212ebec6797279618d6fi0"
            },
            {
              "trait_type": "Side 3",
              "value": "0435b40ae08e1e567e045e8a9e3074d63b84eefc3aeac68490c9254201ca86c1i0"
            },
            {
              "trait_type": "Side 4",
              "value": "bd2aebc14529a53e0bd0f6b2a465edbf2ed8815609210e1d4691cb3ef947d5e3i0"
            },
            {
              "trait_type": "Side 5",
              "value": "9bc521896e67857c90154649514b717f0acc26dfd1e5146b444fee1707fc3bf4i0"
            },
            {
              "trait_type": "Side 6",
              "value": "841ce74e2be40c42544154cdfed2c55e7cd735167da0edf4d96591f38903edddi0"
            },
            {
              "trait_type": "Version",
              "value": "v3"
            },
            {
              "trait_type": "Title",
              "value": "Johannes x Sylvo, September 12"
            }
          ]
        }
      },
      {
        "inscriptionId": "86497740430199bd98b5007ba2872b4c2bfe2a24351b5ac30b385457e3431053i0",
        "meta": {
          "name": "Ordinal Cube #26 (Sylvo x Johannes, September 12)",
          "attributes": [
            {
              "trait_type": "Side 1",
              "value": "841ce74e2be40c42544154cdfed2c55e7cd735167da0edf4d96591f38903edddi0"
            },
            {
              "trait_type": "Side 2",
              "value": "9bc521896e67857c90154649514b717f0acc26dfd1e5146b444fee1707fc3bf4i0"
            },
            {
              "trait_type": "Side 3",
              "value": "bd2aebc14529a53e0bd0f6b2a465edbf2ed8815609210e1d4691cb3ef947d5e3i0"
            },
            {
              "trait_type": "Side 4",
              "value": "0435b40ae08e1e567e045e8a9e3074d63b84eefc3aeac68490c9254201ca86c1i0"
            },
            {
              "trait_type": "Side 5",
              "value": "570a331886dbaa51d3c2997d9d52dad282b91b01e64e212ebec6797279618d6fi0"
            },
            {
              "trait_type": "Side 6",
              "value": "6622a6fadba7d22ed333c1dbd0b557b1910a977308c4bcb3cab1e68209f31201i0"
            },
            {
              "trait_type": "Version",
              "value": "v3"
            },
            {
              "trait_type": "Title",
              "value": "Sylvo x Johannes, September 12"
            }
          ]
        }
      }
    ];

    const expected = [
      '6622a6fadba7d22ed333c1dbd0b557b1910a977308c4bcb3cab1e68209f31201i0',
      '570a331886dbaa51d3c2997d9d52dad282b91b01e64e212ebec6797279618d6fi0',
      '0435b40ae08e1e567e045e8a9e3074d63b84eefc3aeac68490c9254201ca86c1i0',
      'bd2aebc14529a53e0bd0f6b2a465edbf2ed8815609210e1d4691cb3ef947d5e3i0',
      '9bc521896e67857c90154649514b717f0acc26dfd1e5146b444fee1707fc3bf4i0',
      '841ce74e2be40c42544154cdfed2c55e7cd735167da0edf4d96591f38903edddi0',
      '841ce74e2be40c42544154cdfed2c55e7cd735167da0edf4d96591f38903edddi0',
      '9bc521896e67857c90154649514b717f0acc26dfd1e5146b444fee1707fc3bf4i0',
      'bd2aebc14529a53e0bd0f6b2a465edbf2ed8815609210e1d4691cb3ef947d5e3i0',
      '0435b40ae08e1e567e045e8a9e3074d63b84eefc3aeac68490c9254201ca86c1i0',
      '570a331886dbaa51d3c2997d9d52dad282b91b01e64e212ebec6797279618d6fi0',
      '6622a6fadba7d22ed333c1dbd0b557b1910a977308c4bcb3cab1e68209f31201i0'
    ];

    const result = collectClaimedInscriptionIds(testData);
    expect(result).toEqual(expected);
  });

});


describe('sortInscriptions', () => {
  it('should sort the inscriptions primarily by blockheight and secondarily by inscriptionnumber', () => {
    const inscriptions: LooksLikeOrdinalsbotInscription[] = [
      { inscriptionid: 'id4', inscriptionnumber: 2, contentstr: 'Content 4', blockheight: 102 },
      { inscriptionid: 'id2', inscriptionnumber: 1, contentstr: 'Content 2', blockheight: 101 },
      { inscriptionid: 'id1', inscriptionnumber: 0, contentstr: 'Content 1', blockheight: 100 },
      { inscriptionid: 'id3', inscriptionnumber: 1, contentstr: 'Content 3', blockheight: 100 },
      { inscriptionid: 'id5', inscriptionnumber: 3, contentstr: 'Content 5', blockheight: 102 },
    ];

    const sorted = sortInscriptions(inscriptions);
    expect(sorted).toEqual([
      { inscriptionid: 'id1', inscriptionnumber: 0, contentstr: 'Content 1', blockheight: 100 },
      { inscriptionid: 'id3', inscriptionnumber: 1, contentstr: 'Content 3', blockheight: 100 },
      { inscriptionid: 'id2', inscriptionnumber: 1, contentstr: 'Content 2', blockheight: 101 },
      { inscriptionid: 'id4', inscriptionnumber: 2, contentstr: 'Content 4', blockheight: 102 },
      { inscriptionid: 'id5', inscriptionnumber: 3, contentstr: 'Content 5', blockheight: 102 },
    ]);
  });

  it('should handle an empty array', () => {
    const inscriptions: LooksLikeOrdinalsbotInscription[] = [];
    const sorted = sortInscriptions(inscriptions);
    expect(sorted).toEqual([]);
  });
});
