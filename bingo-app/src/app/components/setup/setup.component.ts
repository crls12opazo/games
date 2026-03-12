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
    prize = signal<string>('');
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

    async startGame(): Promise<void> {
        this.isStarting.set(true);
        try {
            console.log('🚀 Iniciando juego desde SetupComponent');
            const gameId = await this.bingoService.initializeGame(this.playerCount(), this.prize());
            console.log('✅ Navegando a /game/' + gameId + '/host');
            this.router.navigate(['/game', gameId, 'host']);
        } catch (error) {
            console.error('❌ Error al iniciar juego:', error);
            this.isStarting.set(false);
        }
    }

    resumeGame(): boolean {
        return false; // Disabled - each game has unique ID
    }

    async onResumeGame(): Promise<void> {
        // No longer used
    }
}
