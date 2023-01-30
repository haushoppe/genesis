import { AllowlistEntry } from '../types/allowlist-entry';
import { AllowlistService } from './allowlist.service';
import * as path from 'path';
import { CacheService } from './cache.service';


const expected: AllowlistEntry = {
  timestamp: 'Mon Dec 05 2022 22:53:10 GMT+0000 (Coordinated Universal Time)',
  ipAddressHash: '00000000000000000000000000000001',
  mintWallet: '0x0000000000000000000000000000000000000001',
  unverifiedWallet: 'false',
  walletBalance: '0.2247778363123946',
  discord: 'DummyUser1#0001',
  discordId: '111111111111111111',
  twitter: 'ethspresso',
  twitterId: '100000000000000001',
  twitterFollowerCount: '1266',
  twitterAccountCreationDate: 'Fri May 11 2018 15:08:45 GMT+0000 (Coordinated Universal Time)',
  email: '',
  status: 'PENDING',
  collab: ''
};

describe('AllowlistService', () => {
  let service: AllowlistService;

  beforeAll(async () => {
    service = new AllowlistService(new CacheService());
    service.allowlistFolder = path.resolve(__dirname + '../../../assets/data/');
  });

  it('should parse directly a string to AllowlistEntry[]"', () => {

    const testData = `timestamp,ipAddressHash,mintWallet,unverifiedWallet,walletBalance,discord,discordId,twitter,twitterId,twitterFollowerCount,twitterAccountCreationDate,email,status,collab
Mon Dec 05 2022 22:53:10 GMT+0000 (Coordinated Universal Time),00000000000000000000000000000001,0x0000000000000000000000000000000000000001,false,0.2247778363123946,DummyUser1#0001,111111111111111111,ethspresso,100000000000000001,1266,Fri May 11 2018 15:08:45 GMT+0000 (Coordinated Universal Time),,PENDING,
Sun Jan 01 2023 12:13:05 GMT+0000 (Coordinated Universal Time),00000000000000000000000000000002,0x0000000000000000000000000000000000000002,false,0.3557239461996932,DummyUser2#0002,222222222222222222,DummyUser2,100000002,1261,Wed Aug 25 2010 07:55:30 GMT+0000 (Coordinated Universal Time),dummy2@example.com,PENDING,
Tue Dec 06 2022 14:06:58 GMT+0000 (Coordinated Universal Time),00000000000000000000000000000003,0x0000000000000000000000000000000000000003,false,0.4624865849218966,DummyUser3#0003,333333333333333333,DummyUser3,100000000000000003,1311,Thu Apr 02 2020 19:04:36 GMT+0000 (Coordinated Universal Time),,PENDING,
Mon Dec 05 2022 23:02:08 GMT+0000 (Coordinated Universal Time),00000000000000000000000000000004,0x8c11c53f77ad5e91fb13611904f2f59b07aa7c93,false,0.01082039734944856,Hans#6438,444444444444444444,DummyUser4,100000000000000004,1352,Sun Jun 13 2021 08:45:36 GMT+0000 (Coordinated Universal Time),johannes@haushoppe.art,PENDING,
Mon Dec 19 2022 13:26:37 GMT+0000 (Coordinated Universal Time),00000000000000000000000000000005,0x0000000000000000000000000000000000000005,false,0.1746380376567292,DummyUser5#0005,555555555555555555,DummyUser5,100000005,334,Mon Nov 15 2010 17:22:55 GMT+0000 (Coordinated Universal Time),,PENDING,
    `
    const entries = service.parseHeymintCsv(testData);
    expect(entries[0]).toEqual(expected);
  });

  it('should parse a file to AllowlistEntry[]"', () => {
    const entries = service.parseHeymintCsvFromFile('allowlist_genesis.csv');
    expect(entries[0]).toEqual(expected);
  });

  it('should provide a simple wallet-list for a token', () => {

    const mintWallets = service.getMintWallets('genesis');
    expect(mintWallets).toEqual([
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000003',
      '0x8c11c53f77ad5e91fb13611904f2f59b07aa7c93',
      '0x0000000000000000000000000000000000000005'
    ]);
  });
});
