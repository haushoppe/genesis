import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';

import { blockies } from './blockies';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-blocky-identicon',
  templateUrl: './blocky-identicon.component.html',
  styleUrls: ['./blocky-identicon.component.scss'],
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlockyIdenticonComponent implements AfterViewInit {

  @ViewChild('canvas', { read: ElementRef })
  canvas?: ElementRef;

  _address?: string;

  @Input()
  set address(value: string | undefined) {
    this._address = value;
    this.render();
  }

  @Input()
  blockyClass?: string;

  ngAfterViewInit() {
    this.render();
  }

  render() {
    if (this.canvas && this._address) {
      blockies.render({ seed: this._address }, this.canvas.nativeElement);
    }
  }
}
