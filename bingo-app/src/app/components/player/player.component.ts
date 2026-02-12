import { Component, OnInit, signal, computed, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BingoService, PlayerCard, BINGO_LETTERS, FREE_INDEX } from '../../services/bingo.service';

@Component({
    selector: 'app-player',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './player.component.html'
})
export class PlayerComponent implements OnInit, OnDestroy {
    playerId = signal<number>(0);
    player = signal<PlayerCard | null>(null);
    showUnmarkModal = signal(false);
    pendingUnmarkNumber = signal<number | null>(null);
    showWinAnimation = signal(false);
    confettiPieces = signal<{ left: string; color: string; delay: string; size: string }[]>([]);

    private refreshInterval: any;

    readonly bingoLetters = BINGO_LETTERS;
    readonly freeIndex = FREE_INDEX;

    /** Count of marked numbers excluding FREE */
    readonly markedCount = computed(() => {
        const p = this.player();
        if (!p) return 0;
        // Subtract 1 for the FREE space which is always marked
        return Math.max(0, p.markedNumbers.size - 1);
    });

    /** Total markable numbers (24, excluding FREE) */
    readonly totalMarkable = 24;

    readonly progress = computed(() => {
        return (this.markedCount() / this.totalMarkable) * 100;
    });

    /**
     * Returns the player's card as a 5x5 grid (array of 5 rows, each with 5 cells).
     */
    readonly cardGrid = computed(() => {
        const p = this.player();
        if (!p) return [];
        const grid: { value: number; isFree: boolean; row: number; col: number }[][] = [];
        for (let row = 0; row < 5; row++) {
            const rowData: { value: number; isFree: boolean; row: number; col: number }[] = [];
            for (let col = 0; col < 5; col++) {
                const index = row * 5 + col;
                const value = p.numbers[index];
                rowData.push({
                    value,
                    isFree: value === -1,
                    row,
                    col
                });
            }
            grid.push(rowData);
        }
        return grid;
    });

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private bingoService: BingoService
    ) { }

    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            const id = parseInt(params['player'], 10);
            if (!id || isNaN(id)) {
                this.router.navigate(['/']);
                return;
            }

            this.playerId.set(id);

            // Load from localStorage first
            const loaded = this.bingoService.loadPlayerState(id);
            if (loaded) {
                this.updatePlayerSignal();
            } else {
                this.router.navigate(['/']);
                return;
            }
        });

        // Periodically refresh game state from localStorage (for real-time drawn numbers)
        this.refreshInterval = setInterval(() => {
            this.refreshGameState();
        }, 2000);
    }

    ngOnDestroy(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    refreshGameState(): void {
        const stateStr = localStorage.getItem('bingo-game-state');
        if (stateStr) {
            try {
                const state = JSON.parse(stateStr);
                // Update drawn numbers in the service
                this.bingoService.drawnNumbers.set(state.drawnNumbers || []);
                this.bingoService.currentBall.set(state.currentBall);
            } catch {
                // ignore
            }
        }
    }

    updatePlayerSignal(): void {
        const p = this.bingoService.getPlayer(this.playerId());
        if (p) {
            this.player.set({ ...p, markedNumbers: new Set(p.markedNumbers) });
        }
    }

    onNumberTap(number: number): void {
        // Cannot tap FREE space
        if (number === -1) return;

        const p = this.player();
        if (!p) return;

        if (p.markedNumbers.has(number)) {
            // Show unmark confirmation modal
            this.pendingUnmarkNumber.set(number);
            this.showUnmarkModal.set(true);
        } else {
            // Mark the number
            const won = this.bingoService.markNumber(this.playerId(), number);
            this.updatePlayerSignal();
            if (won) {
                this.triggerWinAnimation();
            }
        }
    }

    confirmUnmark(): void {
        const num = this.pendingUnmarkNumber();
        if (num !== null) {
            this.bingoService.unmarkNumber(this.playerId(), num);
            this.updatePlayerSignal();
        }
        this.showUnmarkModal.set(false);
        this.pendingUnmarkNumber.set(null);
    }

    cancelUnmark(): void {
        this.showUnmarkModal.set(false);
        this.pendingUnmarkNumber.set(null);
    }

    isMarked(number: number): boolean {
        const p = this.player();
        return p ? p.markedNumbers.has(number) : false;
    }

    triggerWinAnimation(): void {
        this.showWinAnimation.set(true);

        // Generate confetti
        const colors = ['#f59e0b', '#6366f1', '#22c55e', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];
        const pieces: { left: string; color: string; delay: string; size: string }[] = [];

        for (let i = 0; i < 50; i++) {
            pieces.push({
                left: `${Math.random() * 100}%`,
                color: colors[Math.floor(Math.random() * colors.length)],
                delay: `${Math.random() * 2}s`,
                size: `${8 + Math.random() * 12}px`
            });
        }

        this.confettiPieces.set(pieces);
    }

    getCurrentBallLetter(): string {
        const ball = this.currentBall();
        if (!ball) return '';
        return this.bingoService.getLetterForNumber(ball);
    }

    get currentBall() {
        return this.bingoService.currentBall;
    }

    get drawnNumbers() {
        return this.bingoService.drawnNumbers;
    }
}
