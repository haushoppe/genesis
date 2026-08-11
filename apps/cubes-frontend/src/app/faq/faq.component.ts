import { NgClass } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Faq {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss'],
  imports: [RouterLink, NgClass],
})
export class FaqComponent {
  activeIndex = 0;

  /**
   * FAQ answers are trusted HTML strings from this file, rendered via
   * `[innerHTML]` in the template. Angular's DomSanitizer runs on
   * `[innerHTML]` by default (whitelist-based HTML sanitisation, no
   * bypass), so any `<script>` or event-handler attribute in these
   * strings would be stripped at render time — the strings are safe.
   *
   * Formerly authored in markdown and rendered through
   * `marked` + `bypassSecurityTrustHtml` in a `parseMarkdown` pipe.
   * Dropped that dependency: the whole FAQ used two links, a few bold
   * phrases, and one long entry with `<h4>` + `<ol>` + `<ul>` — a
   * markdown parser plus an XSS-defense bypass for that surface is
   * over-engineered.
   */
  faqs: Faq[] = [
    {
      question: 'What is the purpose of the "Ordinal Cubes" project?',
      answer: `This project allows anyone to create art on the Bitcoin blockchain. The artistic process consists of selecting suitable images that are already present on the chain.<br><br>Additionally this project seeks to fully utilize the technical possibilities around Ordinals and Inscriptions. Normally, collections are pre-generated, and all digital artifacts are known from the start. The buyer acquires one of the artifacts without any possibility of intervening in the process. We want to reverse this process - the art collector becomes the curator and chooses the images to be added to the cube. <strong>It's a bit like fx(params), but for Bitcoin!</strong> Furthermore, the cube artifacts have been generated with the maximum possible technical compression. Each individual inscription stores data with exactly <strong>557 bytes</strong> in size, making it incredibly efficient. This efficiency is made possible through the use of recursive inscriptions.`,
    },
    {
      question: 'Where can I find suitable inscriptions with images?',
      answer: `The mint page already suggests a curated collection by default and pre-fills the six sides for you. Just mint what you like, or click "Craft another cube" to reshuffle. If you'd rather pick your own, open the Customize panel and paste six inscription-ids. Any ordinals explorer works to browse for images, e.g. <a href="https://ordpool.space/" target="_blank" rel="noopener">ordpool.space</a> (our own) or <a href="https://ordinals.com/" target="_blank" rel="noopener">ordinals.com</a>. <strong>Avoid black sides at all costs</strong>: a broken or missing inscription renders as a black face and ruins the cube. Only the first frame of animated GIFs is shown.`,
    },
    {
      question: 'How do I create a cube?',
      answer:
        'Click <strong>Connect wallet</strong> and pick your ordinals-aware Bitcoin wallet, then enter six Inscription IDs into the form (or use the pre-filled suggestion) and click <strong>"Mint my cube!"</strong>. Each cube displays the image of one inscription on each of its six sides. Your wallet prompts you to sign a commit transaction; a reveal transaction follows automatically. When the reveal confirms, your cube is live on-chain and lands on your ordinals address.',
    },
    {
      question: 'What is the TXIDiN format?',
      answer:
        'Inscription IDs are of the form TXID<strong>i</strong>N, where TXID is the transaction ID of the reveal transaction, and N is the index of the inscription in the reveal transaction. The small letter <strong>"i"</strong> separates both entries. Please provide six Inscription IDs to create a new cube!',
    },
    {
      question: 'How do I pay for my cube?',
      answer:
        'Your wallet pays the two on-chain transactions (commit + reveal) directly from its funded payment address. There is no invoice, no third-party middleman, and no Lightning fallback, just a normal wallet-signed Bitcoin transaction. Make sure your payment address holds enough BTC before you click Mint.',
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
    },
    {
      question: 'Which wallet should I use to manage my Ordinals?',
      answer:
        'Click <strong>Connect wallet</strong> at the top-right to see every wallet we support. All are non-custodial: you keep full control of your funds. If you\'re not sure which one to pick, <a href="https://www.xverse.app/" target="_blank" rel="noopener">Xverse</a> is a safe default.',
    },
    {
      question: 'Do I get anything extra when I mint a cube?',
      answer:
        'Yes. Every cube mint also inscribes two <a href="https://cat21.space/" target="_blank" rel="noopener">CAT-21</a> cats as a side effect: the commit and the reveal transactions both carry <code>nLockTime=21</code>, which is the CAT-21 protocol marker. Two free cats per cube, on the house. Claim them at <a href="https://cat21.space/" target="_blank" rel="noopener">cat21.space</a>.',
    },
    {
      question: 'What is the "utility" of this project?',
      answer: 'There is no utility. This is a digital art experiment!',
    },
    {
      question: 'Positioning of the cube in the world space',
      answer: `<h4>What is the world space?</h4>
<p>The world space is a global, fixed coordinate system in a 3D scene. The origin (0,0,0) of our world space is by default at the center of the scene.</p>

<h4>How is our cube positioned in the world space?</h4>
<p>In our setup, the cube is positioned at the origin (0,0,0) of the world space. This means the cube's center is aligned with the center of the scene.</p>

<h4>How is the world space oriented?</h4>
<p>The y-axis is the up direction, and the x and z axes form a horizontal plane:</p>
<ul>
  <li>The positive x-axis points to the right.</li>
  <li>The positive y-axis points up.</li>
  <li>The positive z-axis points out of the screen towards the viewer.</li>
</ul>
<p>However, in our setup, we've adjusted the camera to look towards the positive z-axis, so:</p>
<ul>
  <li>The positive z-axis points into the screen, away from the viewer.</li>
  <li>The negative z-axis points out of the screen, towards the viewer.</li>
</ul>
<img src="/assets/coordinate_system_cube.png" width="50%">

<br><br>

<h4>Where is the camera in relation to the cube?</h4>
<p>Our camera is positioned on the positive z-axis, at a slightly elevated position. This means the camera is looking down towards the cube from in front of the screen.</p>
<img src="/assets/coordinate_system.svg" width="50%">

<br><br>

<h4>How is the light positioned in the scene?</h4>
<p>We have two lights in our scene:</p>
<ol>
  <li>A point light positioned directly above the cube along the y-axis, which casts shadows.</li>
  <li>A point light positioned in front of the cube along the positive z-axis, which provides additional illumination.</li>
</ol>`,
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
