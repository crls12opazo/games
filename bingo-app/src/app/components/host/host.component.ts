import { Component, OnInit, signal, computed, ElementRef, ViewChildren, QueryList, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BingoService, BINGO_LETTERS, BINGO_RANGES, TOTAL_BALLS } from '../../services/bingo.service';
import { SpeechService } from '../../services/speech.service';
import * as QRCode from 'qrcode';
import { Unsubscribe } from 'firebase/firestore';

@Component({
    selector: 'app-host',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './host.component.html'
})
export class HostComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChildren('qrCanvas') qrCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;

    readonly bingoService = inject(BingoService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    readonly speechService = inject(SpeechService);
    private unsubscribe?: Unsubscribe;
    
    gameId = signal<string>('');

    showBallAnimation = signal(false);
    animatingBall = signal<number | null>(null);
    showQRPanel = signal(false);
    showResetConfirm = signal(false);

    readonly currentBall = this.bingoService.currentBall;
    readonly lastFiveBalls = this.bingoService.lastFiveBalls;
    readonly remainingBalls = this.bingoService.remainingBalls;
    readonly allNumbersBoard = this.bingoService.allNumbersBoard;
    readonly drawnNumbers = this.bingoService.drawnNumbers;
    readonly isDrawing = this.bingoService.isDrawing;
    readonly players = this.bingoService.players;
    readonly winnerId = this.bingoService.winnerId;

    readonly drawnCount = computed(() => this.drawnNumbers().length);
    readonly totalBalls = TOTAL_BALLS;
    readonly bingoLetters = BINGO_LETTERS;
    readonly bingoRanges = BINGO_RANGES;

    /**
     * Generates a board organized by BINGO columns for the host display.
     * Each column has 15 numbers with their drawn status.
     */
    readonly boardByColumns = computed(() => {
        const drawn = new Set(this.drawnNumbers());
        return BINGO_RANGES.map(([min, max], colIndex) => ({
            letter: BINGO_LETTERS[colIndex],
            numbers: Array.from({ length: max - min + 1 }, (_, i) => ({
                number: min + i,
                drawn: drawn.has(min + i)
            }))
        }));
    });

    ngOnInit(): void {
        // Get gameId from route
        const gameIdFromRoute = this.route.snapshot.paramMap.get('gameId');
        if (!gameIdFromRoute) {
            console.error('No gameId in route');
            this.router.navigate(['/']);
            return;
        }
        
        this.gameId.set(gameIdFromRoute);
        console.log('🎮 Host component - Game ID:', gameIdFromRoute);

        if (this.players().length === 0) {
            // Load game from Firestore
            this.bingoService.loadGameStateFromFirestore(gameIdFromRoute).then(loaded => {
                if (!loaded) {
                    console.error('Game not found in Firestore');
                    this.router.navigate(['/']);
                    return;
                }
            });
        }

        // Subscribe to real-time updates from Firestore
        this.unsubscribe = this.bingoService.subscribeToGameState(gameIdFromRoute);
        
        // Add keyboard listener for spacebar
        this.setupKeyboardListeners();
    }

    ngOnDestroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        // Remove keyboard listener
        this.removeKeyboardListeners();
    }

    private setupKeyboardListeners(): void {
        document.addEventListener('keydown', this.handleKeyPress);
    }

    private removeKeyboardListeners(): void {
        document.removeEventListener('keydown', this.handleKeyPress);
    }

    private handleKeyPress = (event: KeyboardEvent): void => {
        // Spacebar or Space key
        if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault(); // Prevent page scroll
            this.drawBall();
        }
    };

    ngAfterViewInit(): void {
        this.qrCanvases.changes.subscribe(() => {
            this.generateQRs();
        });
    }

    async drawBall(): Promise<void> {
        if (this.isDrawing() || this.drawnNumbers().length >= TOTAL_BALLS) return;

        this.showBallAnimation.set(true);
        this.animatingBall.set(null);

        const ball = await this.bingoService.drawBall();

        if (ball > 0) {
            this.animatingBall.set(ball);
            
            // Announce the ball with text to speech
            const letter = this.bingoService.getLetterForNumber(ball);
            this.speechService.announceBall(letter, ball);
            
            setTimeout(() => {
                this.showBallAnimation.set(false);
            }, 700);
        }
    }

    toggleQRPanel(): void {
        this.showQRPanel.update(v => !v);
        if (this.showQRPanel()) {
            setTimeout(() => this.generateQRs(), 100);
        }
    }

    generateQRs(): void {
        if (!this.qrCanvases) return;

        const baseUrl = window.location.origin;
        const currentGameId = this.gameId();
        
        this.qrCanvases.forEach((canvasRef, index) => {
            const playerId = this.players()[index]?.id;
            if (playerId !== undefined && currentGameId) {
                const url = `${baseUrl}/game/${currentGameId}/player/${playerId}`;
                QRCode.toCanvas(canvasRef.nativeElement, url, {
                    width: 180,
                    margin: 2,
                    color: {
                        dark: '#1e293b',
                        light: '#ffffff'
                    }
                });
            }
        });
    }

    confirmReset(): void {
        this.showResetConfirm.set(true);
    }

    cancelReset(): void {
        this.showResetConfirm.set(false);
    }

    resetGame(): void {
        this.bingoService.resetGame();
        this.showResetConfirm.set(false);
        this.router.navigate(['/']);
    }

    toggleAudio(): void {
        this.speechService.toggle();
    }

    onVoiceChange(event: Event): void {
        const select = event.target as HTMLSelectElement;
        const index = parseInt(select.value, 10);
        this.speechService.setVoice(index);
    }

    getWinnerName(): string {
        const id = this.winnerId();
        if (!id) return '';
        const winner = this.players().find(p => p.id === id);
        return winner?.name || `Jugador ${id}`;
    }

    getPlayerUrl(playerId: number): string {
        const currentGameId = this.gameId();
        return `${window.location.origin}/game/${currentGameId}/player/${playerId}`;
    }

    /**
     * Get the BINGO letter prefix for the current ball display.
     */
    getCurrentBallLetter(): string {
        const ball = this.currentBall();
        if (!ball) return '';
        return this.bingoService.getLetterForNumber(ball);
    }

    getBallColor(number: number): string {
        if (number <= 15) return 'from-red-500 to-red-700';       // B
        if (number <= 30) return 'from-orange-500 to-orange-700'; // I
        if (number <= 45) return 'from-yellow-500 to-yellow-700'; // N
        if (number <= 60) return 'from-green-500 to-green-700';   // G
        if (number <= 75) return 'from-blue-500 to-blue-700';     // O
        return 'from-purple-500 to-purple-700';
    }

    getBallLetter(number: number): string {
        return this.bingoService.getLetterForNumber(number);
    }
}
