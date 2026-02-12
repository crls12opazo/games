import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BingoService } from '../../services/bingo.service';

@Component({
    selector: 'app-setup',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './setup.component.html'
})
export class SetupComponent {
    playerCount = signal(2);
    maxPlayers = 10;
    minPlayers = 2;
    isStarting = signal(false);

    constructor(
        private bingoService: BingoService,
        private router: Router
    ) { }

    increment(): void {
        if (this.playerCount() < this.maxPlayers) {
            this.playerCount.update(v => v + 1);
        }
    }

    decrement(): void {
        if (this.playerCount() > this.minPlayers) {
            this.playerCount.update(v => v - 1);
        }
    }

    startGame(): void {
        this.isStarting.set(true);
        setTimeout(() => {
            this.bingoService.initializeGame(this.playerCount());
            this.router.navigate(['/host']);
        }, 500);
    }

    resumeGame(): boolean {
        return !!localStorage.getItem('bingo-game-state');
    }

    onResumeGame(): void {
        const loaded = this.bingoService.loadGameState();
        if (loaded) {
            this.bingoService.phase.set('host');
            this.router.navigate(['/host']);
        }
    }
}
