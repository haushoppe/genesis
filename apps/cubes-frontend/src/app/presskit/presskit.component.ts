import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';


@Component({
    selector: 'app-presskit',
    templateUrl: './presskit.component.html',
    styleUrls: ['./presskit.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink
    ]
})
export class PresskitComponent {


}
