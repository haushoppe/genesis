import { NgClass } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ParseMarkdownPipe } from '../parse-markdown.pipe';

interface Faq {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss'],
  imports: [ParseMarkdownPipe, RouterLink, NgClass],
})
export class FaqComponent {
  activeIndex = 0;

  faqs: Faq[] = [
    {
      question: 'What is the purpose of the "Ordinal Cubes" project?',
      answer: `This project allows anyone to create art on the Bitcoin blockchain. The artistic process consists of selecting suitable images that are already present on the chain.<br><br>Additionally this project seeks to fully utilize the technical possibilities around Ordinals and Inscriptions. Normally, collections are pre-generated, and all digital artifacts are known from the start. The buyer acquires one of the artifacts without any possibility of intervening in the process. We want to reverse this process - the art collector becomes the curator and chooses the images to be added to the cube. __It's a bit like fx(params), but for Bitcoin!__ Furthermore, the cube artifacts have been generated with the maximum possible technical compression. Each individual inscription stores data with exactly __557 bytes__ in size, making it incredibly efficient. This efficiency is made possible through the use of recursive inscriptions.`,
    },
    {
      question: 'Where can I find suitable inscriptions with images?',
      answer: `Your best bet is to search at [Magic Eden](https://magiceden.io/ordinals) or [Ord.io](https://www.ord.io/?contentType=image). Make sure that none of the sides of your cube turns black, that would be a pity. For animated GIFs, only the first frame will be displayed.`,
    },
    // {
    //   question: "What are Bitcoin Ordinals?",
    //   answer: "Ordinals are digital assets inscribed on a satoshi, the lowest denomination of a Bitcoin (BTC). Ordinals only exist onchain and are totally immutable, meaning they cannot be altered in any way."
    // },
    // {
    //   question: "What is the Ordinal theory?",
    //   answer: "The Ordinal theory offers a unique method to track and potentially assign value to individual satoshis, even if they are not officially recorded on the blockchain."
    // },
    // {
    //   question: "What are inscriptions in the context of Bitcoin?",
    //   answer: "Inscriptions refer to a novel method of storing data in the Bitcoin blockchain. Each inscription is assigned to an individual Satoshi. They represent a newly invented functionality within the Bitcoin ecosystem."
    // },
    // {
    //   question: "How is ownership of inscriptions changed?",
    //   answer: "Ownership of inscriptions is linked to the individual owner of the Satoshi. The ownership can be transferred by sending it to any Bitcoin address. The recipient of the transfer becomes the new owner of the Satoshi and its inscription."
    // },
    {
      question: 'How do I create a cube?',
      answer:
        'Connect an ordinals-aware Bitcoin wallet (Xverse, Leather, Unisat, OKX, Phantom, or Oyl), enter six Inscription IDs into the form, and click "Mint my cube!". Each cube displays the image of one inscription on each of its six sides. Your wallet will prompt you to sign a commit transaction; a reveal transaction follows automatically. When the reveal confirms, your cube is live on-chain and lands on your ordinals address.',
    },
    {
      question: 'What is the TXIDiN format?',
      answer:
        'Inscription IDs are of the form TXID<strong>i</strong>N, where TXID is the transaction ID of the reveal transaction, and N is the index of the inscription in the reveal transaction. The small letter __"i"__ separates both entries. Please provide six Inscription IDs to create a new cube!',
    },
    {
      question: 'What is a taproot address?',
      answer:
        'A taproot address is a type of Bitcoin address that starts with "bc1p"... . This type of address is best suited to receive Ordinals. Use any ordinals-aware wallet (Xverse, Leather, Unisat, OKX, Phantom, or Oyl).',
    },
    {
      question: 'How do I pay for my cube?',
      answer:
        'Your wallet pays the two on-chain transactions (commit + reveal) directly from its funded payment address. There is no invoice, no third-party middleman, and no Lightning fallback — just a normal wallet-signed Bitcoin transaction. Make sure your payment address holds enough BTC before you click Mint.',
    },
    {
      question: 'What happens after I click Mint?',
      answer:
        'Your wallet signs a commit transaction that we broadcast to the Bitcoin mempool. As soon as the commit is in the mempool, we broadcast the reveal transaction that carries your cube HTML. Once the reveal confirms in a block, the cube is on-chain forever.',
    },
    {
      question: 'How is the data of my cube stored?',
      answer:
        'The data for your cube is fully stored on the Bitcoin blockchain ("onchain") and remains unchangeable forever.',
      //  At least almost forever. Since the data is stored in the (segregated) witness data area, it could theoretically be lost if all nodes were to prune their data. But this is really very, very unlikely. After all, Bitcoin is maximally decentralized. There only needs to be one node operator on this planet who keeps the data.
    },
    // {
    //   question: 'Does this website store any data? What about privacy?',
    //   answer: 'We absolutely do not store anything. No cookies, no tracking, no log files. We host on a static web server (Cloudflare Pages). The backend also does not store any data and doesn\'t even have a database, its filesystem is ephemeral. We really know nothing about you. If you refresh the page, everything is gone. __The only storage is the Bitcoin blockchain!__'
    // },
    {
      question: 'Which wallet should I use to manage my Ordinals?',
      answer:
        'Any ordinals-aware Bitcoin wallet works — the mint page auto-detects installed extensions. Good non-custodial choices: [Xverse](https://www.xverse.app/), [Leather](https://leather.io/), [Unisat](https://unisat.io/), [OKX Wallet](https://www.okx.com/web3), Phantom (BTC), or [Oyl](https://oyl.io/). All keep you in full control of your funds.',
    },
    {
      question: 'Do I get anything extra when I mint a cube?',
      answer:
        'Yes. Every cube mint also inscribes two [CAT-21](https://cat21.space/) cats as a side effect — the commit and the reveal transactions both carry `nLockTime=21`, which is the CAT-21 protocol marker. Two free cats per cube, on the house. Claim them at [cat21.space](https://cat21.space/).',
    },
    {
      question: 'What is the "utility" of this project?',
      answer: `There is no utility. This is a digital art experiment!`,
    },
    {
      question: 'Positioning of the cube in the world space',
      answer: `#### What is the world space?
The world space is a global, fixed coordinate system in a 3D scene. The origin (0,0,0) of our world space is by default at the center of the scene.

#### How is our cube positioned in the world space?
In our setup, the cube is positioned at the origin (0,0,0) of the world space. This means the cube's center is aligned with the center of the scene.

#### How is the world space oriented?
The y-axis is the up direction, and the x and z axes form a horizontal plane:

* The positive x-axis points to the right.
* The positive y-axis points up.
* The positive z-axis points out of the screen towards the viewer.

However, in our setup, we've adjusted the camera to look towards the positive z-axis, so:

* The positive z-axis points into the screen, away from the viewer.
* The negative z-axis points out of the screen, towards the viewer.

<img src="/assets/coordinate_system_cube.png" width="50%">

<br><br>

#### Where is the camera in relation to the cube?

Our camera is positioned on the positive z-axis, at a slightly elevated position. This means the camera is looking down towards the cube from in front of the screen.

<img src="/assets/coordinate_system.svg" width="50%">

<br><br>

#### How is the light positioned in the scene?
We have two lights in our scene:

1. A point light positioned directly above the cube along the y-axis, which casts shadows.
2. A point light positioned in front of the cube along the positive z-axis, which provides additional illumination.
`,
    },
    {
      question: 'How can I stop the animation?',
      answer:
        "You can stop the animation by pressing the 'p' key on your keyboard. To resume the animation, press the 'p' key again.",
    },
  ];

  toggle(index: number) {
    this.activeIndex = this.activeIndex === index ? -1 : index;
  }
}
