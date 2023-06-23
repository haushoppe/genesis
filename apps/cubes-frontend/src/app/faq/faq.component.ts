import { AsyncPipe, KeyValuePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LetModule } from '@rx-angular/template/let';
import { PushModule } from '@rx-angular/template/push';

import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { ParseMarkdownPipe } from '../parse-markdown.pipe';
import { SafeResourceUrlPipe } from '../safe-url.pipe';

interface Faq {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss'],
  standalone: true,
  imports: [
    AsyncPipe,
    LoadingIndicatorComponent,
    NgIf,
    ParseMarkdownPipe,
    RouterLink,
    SafeResourceUrlPipe,
    LetModule,
    PushModule,
    NgFor,
    KeyValuePipe,
    NgClass
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaqComponent {

  activeIndex = 0;

  faqs: Faq[] = [
    {
      question: 'What is the purpose of the "Recursive Inscription Cubes" project?',
      answer: `This project allows anyone to create art on the Bitcoin blockchain. The artistic process consists of selecting suitable images that are already present on the chain.<br><br>Additionally this project seeks to fully utilize the technical possibilities around Ordinals and Inscriptions. Normally, collections are pre-generated, and all digital artifacts are known from the start. The buyer acquires one of the artifacts without any possibility of intervening in the process. We want to reverse this process - the art collector becomes the curator and chooses the images to be added to the cube. __It's a bit like fx(params), but for Bitcoin!__ Furthermore, the cube artifacts have been generated with the maximum possible technical compression. Each individual inscription stores data with exactly __577 bytes__ in size, making it incredibly efficient. This efficiency is made possible through the use of recursive inscriptions.`
    },
    {
      question: 'Where can I find suitable inscriptions with images?',
      answer: ` Your best bet is to look at the website ord.io under [Images](https://www.ord.io/?contentType=image) or [GIFs](https://www.ord.io/?contentType=gif), or use the [image search](https://ordinals.hiro.so/explore?f=image) from hiro.so. Make sure that none of the sides of your cube turns black, that would be a pity. For animated GIFs, only the first image will be displayed.`
    },
    {
      question: "What are Bitcoin Ordinals?",
      answer: "Ordinals are a Bitcoin project that has experienced increased interest in recent weeks. They are bringing new excitement around Bitcoin's innovative potential. Ordinals, essentially, are a new and emerging movement within the Bitcoin ecosystem."
    },
    {
      question: "What is the Ordinal theory?",
      answer: "The Ordinal theory offers a unique method to track and potentially assign value to individual satoshis, even if they are not officially recorded on the blockchain."
    },
    {
      question: "What are inscriptions in the context of Bitcoin?",
      answer: "Inscriptions refer to a novel method of storing data in the Bitcoin blockchain. Each inscription is assigned to an individual Satoshi. They represent a newly discovered (or invented) functionality within the Bitcoin ecosystem."
    },
    {
      question: "How is ownership of inscriptions changed?",
      answer: "Ownership of inscriptions is linked to the individual owner of the Satoshi. The ownership can be transferred by sending it to any Bitcoin address. The recipient of the transfer becomes the new owner of the Satoshi and its inscription."
    },
    {
      question: 'How do I create an cube?',
      answer: 'You can create an inscription cube by entering six Inscription IDs and your receiving address to the form. Each cube, with its six sides, displays the image of the respective inscription. After submitting the form, you are required to cover the costs of creating the inscription through a Bitcoin payment.'
    },
    {
      question: 'What is the TXIDiN format?',
      answer: 'Inscription IDs are of the form TXID<strong>i</strong>N, where TXID is the transaction ID of the reveal transaction, and N is the index of the inscription in the reveal transaction. The small letter __"i"__ separates both entries.'
    },
    {
      question: 'What is a taproot address?',
      answer: 'A taproot address is a type of Bitcoin address that starts with "bc1p"... . This type of address is best suited to receive Ordinals. Please only use a wallet specifically designed for Ordinals, for example, the Xverse wallet (see below).'
    },
    {
      question: 'How do I pay for my cube?',
      answer: 'You can pay for your cube directly with either Lightning (instant) or by paying on-chain with Bitcoin (BTC). It\' super simple!'
    },
    {
      question: 'Can I make an on-chain payment via a centralized exchange like Coinbase or Binance?',
      answer: 'That is not a problem. However, please make sure that the exact amount of satoshis reaches us. This means the satoshis to be paid PLUS all additional fees.'
    },
    {
      question: 'What happens after I pay?',
      answer: 'Once your payment is confirmed, your cube is automatically inscribed onto the Bitcoin blockchain and sent to you.'
    },
    {
      question: 'How is the data of my cube stored?',
      answer: 'The data for your cube is fully stored on-chain and remains unchangeable forever. At least almost forever. Since the data is stored in the (segregated) witness data area, it could theoretically be lost if all nodes were to prune their data. But this is really very, very unlikely. After all, Bitcoin is maximally decentralized. There only needs to be one node operator on this planet who keeps the data.'
    },
    {
      question: 'Does this website store any data? What about privacy?',
      answer: 'We absolutely do not store anything. No cookies, no tracking, no log files. We host on a static web server (Cloudflare Pages). The backend also does not store any data and doesn\'t even have a database, its filesystem is ephemeral. We really know nothing about you. If you refresh the page, everything is gone. __The only storage is the Bitcoin blockchain!__'
    },
    {
      question: 'Which wallet should I use to manage my Ordinals?',
      answer: 'We really like the Xverse wallet from [www.xverse.app](https://www.xverse.app/). Anyone who has used MetaMask before will feel right at home.'
    },
    {
      question: 'Q: Which wallet can I use for quick and easy ⚡️ Lightning payments?',
      answer: 'There are a number of excellent Lightning wallets, and our recommendation is the Phoenix Wallet from [phoenix.acinq.co](https://phoenix.acinq.co/). Phoenix has been designed for less technical users. Phoenix takes care of everything under the hood and you will barely notice anything, except that your payments are faster and cheaper. The great thing: Phoenix is a real, self-contained Lightning node that runs on your phone. It does not require you to run another Lightning node at home or in the cloud. It is a __non-custodial__ wallet, you are in full control of your funds.'
    },
    {
      question: 'What is the "utility" of this project?',
      answer: `There is no utility. Well, there's one. With your fees, you pay the miners who secure the network.`
    }
  ];

  toggle(index: number) {
    this.activeIndex = this.activeIndex === index ? -1 : index;
  }

}
