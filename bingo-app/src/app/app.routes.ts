import { Routes } from '@angular/router';
import { SetupComponent } from './components/setup/setup.component';
import { HostComponent } from './components/host/host.component';
import { PlayerComponent } from './components/player/player.component';

export const routes: Routes = [
    { path: '', component: SetupComponent },
    { path: 'host', component: HostComponent },
    { path: 'player', component: PlayerComponent },
    { path: '**', redirectTo: '' }
];
