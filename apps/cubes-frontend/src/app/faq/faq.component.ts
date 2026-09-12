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
      question: 'How does rarity work?',
      answer: `<p>Primarily an art experiment, this project encourages you to appreciate your cube for its aesthetic qualities. However, the thrill of collecting intensifies when considering rarity. So every cube carries a <strong>Rarity Score</strong>, shown on its page. Cubes are scored against each other, and the score moves with every new cube.</p>
<ul>
  <li><strong>Cursed cubes get no score.</strong> A cube is cursed when two of its faces show the same inscription, when a face is black because its side does not render as an image, or when a side was already claimed by an earlier cube.<br>In essence, <strong>each cube claims six inscriptions</strong>, in mint order. First is first!</li>
  <li><strong>Tiers.</strong> The first 100 scored cubes get a bonus of 100 points, cubes 101 to 1,000 get 50, cubes 1,001 to 5,000 get 25. The earlier you get in, the better.</li>
  <li><strong>Collection points.</strong> A cube whose six sides all come from one collection earns up to 100 points. The more cubes show that collection, the more points: the most popular collection pays the full 100, the others in proportion. Mixed cubes earn none.</li>
  <li><strong>Ties</strong> go to the older cube.</li>
  <li>The experiment draws to a close after 10,000 scored cubes.</li>
</ul>
<p>One badge is not a curse and costs nothing: <strong>Cursed | Chrome f*cked us</strong> marks a cube the browser refuses to render although it once did. See the entry above.</p>
<p>Collections are read from our frozen <a href="https://github.com/ordpool-space/magic-eden-ordinals-archive">Magic Eden archive</a>, the same source the mint page draws its suggestions from. The full rules and the data behind every rank live in the <a href="https://github.com/ordpool-space/ordinal-cubes-index#rarity">ordinal-cubes-index</a>.</p>`,
    },
    {
      question: 'What does "Cursed | Chrome f*cked us" mean?',
      answer: `<p>That badge marks a cube whose sides are SVGs <strong>without a fixed size</strong> (they carry only a <code>viewBox</code>, or a width in percent). Such a cube rendered perfectly when it was minted.</p>
<p>Chrome has since stopped accepting an image like that as a 3D texture: it still loads and decodes, but the upload to the graphics card is refused, and the face turns black. Nothing on the blockchain changed. The bytes are the same bytes, the cube is intact, and an artwork that worked simply stopped working one browser release later. You can see it on <a href="https://ordinals.com/" target="_blank" rel="noopener">ordinals.com</a>, where those cubes are black squares today.</p>
<p><strong>Here they still show.</strong> This site redraws such a side onto a canvas first and hands that to the renderer, which is the step the browser now wants. Same bytes, same picture, nothing substituted.</p>
<p>The badge costs no rarity points. It names what was done to the cube, not a flaw in it.</p>`,
    },
    {
      question: 'What is the purpose of the "Ordinal Cubes" project?',
      answer: `This project allows anyone to create art on the Bitcoin blockchain. The artistic process consists of selecting suitable images that are already present on the chain.<br><br>Additionally this project seeks to fully utilize the technical possibilities around Ordinals and Inscriptions. Normally, collections are pre-generated, and all digital artifacts are known from the start. The buyer acquires one of the artifacts without any possibility of intervening in the process. We want to reverse this process - the art collector becomes the curator and chooses the images to be added to the cube. <strong>It's a bit like fx(params), but for Bitcoin!</strong> Furthermore, the cube artifacts have been generated with the maximum possible technical compression. Each individual inscription stores data with exactly <strong>557 bytes</strong> in size, making it incredibly efficient. This efficiency is made possible through the use of recursive inscriptions.`,
    },
    {
      question: 'Why permissionless?',
      answer:
        'Every user mints their own cube. There is no middleman. You can use this website to create a cube, but this is not required (multiple cubes have been minted via alternative tools in the past). Cubes are indexed by this website, and if they are technically valid (see <a href="https://github.com/ordpool-space/ordinal-cubes-index" target="_blank" rel="noopener">the indexer</a>), then they are added to the gallery. This is true permissionless minting.',
    },
    {
      question: 'Where can I find suitable inscriptions with images?',
      answer: `The mint page already suggests a curated collection by default and pre-fills the six sides for you. Just mint what you like, or click "Craft another cube" to reshuffle. If you'd rather pick your own, open the Customize panel and paste six inscription-ids. Any ordinals explorer works to browse for images, e.g. <a href="https://ordpool.space/">ordpool.space</a> (our own) or <a href="https://ordinals.com/" target="_blank" rel="noopener">ordinals.com</a>. <strong>Avoid black sides at all costs</strong>: a broken or missing inscription renders as a black face, ruins the cube and curses it in the rarity score. The mint form checks every side the way the cube renders it and will not mint a cube with a black face. Only the first frame of animated GIFs is shown.`,
    },
    {
      question: 'How do I create a cube?',
      answer:
        'Click <strong>Connect</strong> and pick your ordinals-aware Bitcoin wallet, then enter six Inscription IDs into the form (or use the pre-filled suggestion) and click <strong>"Mint my cube!"</strong>. Each cube displays the image of one inscription on each of its six sides. Your wallet prompts you to sign a commit transaction; a reveal transaction follows automatically. When the reveal confirms, your cube is live on-chain and lands on your ordinals address.',
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
        'Click <strong>Connect</strong> at the top-right to see every wallet we support. All are non-custodial: you keep full control of your funds. If you\'re not sure which one to pick, <a href="https://www.xverse.app/" target="_blank" rel="noopener">Xverse</a> is a safe default.',
    },
    {
      question: 'Do I get anything extra when I mint a cube?',
      answer:
        'Yes. Every cube mint also inscribes two <a href="https://cat21.space/">CAT-21</a> cats as a side effect: the commit and the reveal transactions both carry <code>nLockTime=21</code>, which is the CAT-21 protocol marker. Two free cats per cube, on the house. You can adore them on <a href="https://cat21.space/">cat21.space</a>.',
    },
    {
      question: 'What is the "utility" of this project?',
      answer: 'There is no utility. This is a digital art experiment!<br>And you get two cute cats, if you create the cubes on this website.',
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
