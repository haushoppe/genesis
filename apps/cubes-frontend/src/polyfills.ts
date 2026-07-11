/**
 * Zoneless: no zone.js import. Change detection is driven by
 * signals + provideZonelessChangeDetection() in app.config.ts.
 */

import '@angular/localize/init';

// ordpool-sdk's Xverse connector pulls in `sats-connect`, which
// references `Buffer` + `global` as if it were running in Node.
// Vanilla @angular-devkit/build-angular does not polyfill Node
// built-ins — without these two lines the whole app crashes at
// module-init time with "ReferenceError: global is not defined"
// (buffer alias + Buffer ProvidePlugin are supplied via webpack.config.js).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)['global'] = window;
import { Buffer } from 'buffer';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)['Buffer'] = Buffer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import process from 'process';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)['process'] = process;
