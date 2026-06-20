import { RxPush } from '@rx-angular/template/push';
import { RxLet } from '@rx-angular/template/let';
import { RxFor } from '@rx-angular/template/for';
import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TrimValueAccessorDirective } from '../../trim-value-accessor.directive';
import { UuidValidator } from '../../uuid-validator';

// not used anymore!
@Component({
  selector: 'app-order-select',
  templateUrl: './order-select.component.html',
  styleUrls: ['./order-select.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    RxLet,
    RxFor,
    RxPush,
    RouterLink,
    TrimValueAccessorDirective,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSelectComponent {
  router = inject(Router);

  form = new FormGroup({
    orderId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, UuidValidator()],
    }),
  });

  c = this.form.controls;

  navigateToOrder() {
    this.router.navigate(['/order', this.c.orderId.value]);
  }
}
