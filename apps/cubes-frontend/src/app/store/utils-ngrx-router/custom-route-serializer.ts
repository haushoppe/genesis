import { ActivatedRouteSnapshot, Params, RouterStateSnapshot } from '@angular/router';
import { RouterStateSerializer } from '@ngrx/router-store';

export interface CustomRouterStateSnapshot {
  url: string;
  path: string;
  params: Params;
}

export class CustomRouteSerializer implements RouterStateSerializer<CustomRouterStateSnapshot> {
  serialize(routerState: RouterStateSnapshot): CustomRouterStateSnapshot {
    let route: ActivatedRouteSnapshot | null = routerState.root;
    const path: string[] = [];
    let params = {};

    const { url } = routerState;

    while (route) {
      if (route.routeConfig && route.routeConfig.path) {
        path.push(route.routeConfig.path);
      }
      // params must be collected throughout all route segments
      if (route.params) {
        params = { ...params, ...route.params };
      }

      route = route.firstChild;
    }

    // Only return an object including the URL, path and params instead of the entire snapshot
    return {
      url,
      path: path.join('/'),
      params
    };
  }
}
