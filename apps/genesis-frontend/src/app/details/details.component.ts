import { AsyncPipe, JsonPipe, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, retry, switchMap, tap } from 'rxjs';

import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { ApiService } from '../openapi-client';
import { ParseMarkdownPipe } from './parse-markdown.pipe';
import { SafeResourceUrlPipe } from './safe-url.pipe';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
  standalone: true,
  imports: [
    AsyncPipe,
    LoadingIndicatorComponent,
    NgIf,
    ParseMarkdownPipe,
    RouterLink,
    SafeResourceUrlPipe,
    JsonPipe
  ]
})
export class DetailsComponent {
  loading = false;

  apiService = inject(ApiService);

  nft$ = inject(ActivatedRoute).paramMap.pipe(
    map(paramMap => paramMap.get('tokenId') || ''),
    tap(() => this.loading = true),
    switchMap(tokenId => this.apiService.tokenInfo('genesis', +tokenId).pipe(
      retry({ delay: 1000 })
    )),
    tap(() => this.loading = false)
  );
}
