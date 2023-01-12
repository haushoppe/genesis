import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, retry } from 'rxjs';
import { environment } from '../../environments/environment';
import { mapScale, RawScale, Scale, groupScalesByParentPaintingAndRow, toArrayOfArrayOfArray } from './scale';


@Injectable({
  providedIn: 'root'
})
export class BackendService {

  constructor(private http: HttpClient) { }

  getAllScales(): Observable<Scale[]> {
    return this.http.get<RawScale[]>(environment.api + 'getAll').pipe(
      retry({
        count: 3,
        delay: 1000
      }),
      map(rawScales => rawScales.map(mapScale))
    );
  }

  getAllGroupedScales(): Observable<Scale[][][]> {
    return this.getAllScales().pipe(
      map(groupScalesByParentPaintingAndRow),
      map(toArrayOfArrayOfArray)
    );
  }
}
