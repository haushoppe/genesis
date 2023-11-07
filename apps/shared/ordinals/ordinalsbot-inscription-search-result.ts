
/*
  RESPONSE of GET https://api.ordinalsbot.com/search?text=haushoppe.art
  --> use blockheight as timestamp!
  --> createdat: this is when record is parsed - not the block timestamp
*/
/*
{
  "status": "ok",
  "count": "1",
  "results": [
    {
      "txid": "9475aa8df559d569f7284ce59e97014f28be758e832e212fdbba0202699dd035",
      "inputindex": "0",
      "inscriptionid": "9475aa8df559d569f7284ce59e97014f28be758e832e212fdbba0202699dd035i0",
      "inscriptionnumber": null,
      "blockheight": "795213",
      "contentstr": "XXX",
      "contenttypestr": "text/javascript",
      "contenthash": "6fa5bb5d822031fc2e8819f60cb1564f2abc8c2c8755ebb8777b76aa7224e8e7",
      "contentlength": "2080",
      "createdat": "2023-06-20T17:56:35.341Z"
    }
  ]
}
*/

export interface OrdinalsbotInscription {
  txid: string,
  inputindex: number,
  inscriptionid: string,
  inscriptionnumber: number, // WARNING: sometimes null, reported bug!
  blockheight: number,
  contentstr: string,
  contenttypestr: string,
  contenthash: string,
  contentlength: number,
  createdat: string
};

export interface OrdinalsbotInscriptionSearchResult {
  status: string;
  results: OrdinalsbotInscription[];
  count: number;
  offset?: number;
  itemsPerPage?: number;
  currentPage?: number;
}
