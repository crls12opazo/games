import { Injectable, signal, computed } from '@angular/core';

export interface PlayerCard {
  id: number;
  name: string;
  numbers: number[]; // 25 numbers in row-major order (5x5), -1 = FREE
  markedNumbers: Set<number>;
  hasWon: boolean;
}

export type GamePhase = 'setup' | 'host' | 'player';

export const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];
export const BINGO_RANGES: [number, number][] = [
  [1, 15],   // B
  [16, 30],  // I
  [31, 45],  // N
  [46, 60],  // G
  [61, 75],  // O
];
export const TOTAL_BALLS = 75;
export const FREE_INDEX = 12; // Center of 5x5 grid (row 2, col 2)

@Injectable({
  providedIn: 'root'
})
export class BingoService {
  // Game state signals
  readonly phase = signal<GamePhase>('setup');
  readonly playerCount = signal<number>(2);
  readonly players = signal<PlayerCard[]>([]);
  readonly drawnNumbers = signal<number[]>([]);
  readonly currentBall = signal<number | null>(null);
  readonly isDrawing = signal<boolean>(false);
  readonly winnerId = signal<number | null>(null);

  // Computed
  readonly lastFiveBalls = computed(() => {
    const drawn = this.drawnNumbers();
    return drawn.slice(-5).reverse();
  });

  readonly remainingBalls = computed(() => {
    return TOTAL_BALLS - this.drawnNumbers().length;
  });

  readonly allNumbersBoard = computed(() => {
    const drawn = new Set(this.drawnNumbers());
    return Array.from({ length: TOTAL_BALLS }, (_, i) => ({
      number: i + 1,
      drawn: drawn.has(i + 1)
    }));
  });

  /**
   * Generate a 5x5 BINGO card.
   * Each column has 5 random numbers from its range:
   *   B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
   * The center cell (row 2, col 2 = index 12) is FREE (-1).
   * Numbers are stored in row-major order.
   */
  generateCard(): number[] {
    const columns: number[][] = [];

    for (const [min, max] of BINGO_RANGES) {
      const pool: number[] = [];
      for (let n = min; n <= max; n++) {
        pool.push(n);
      }
      // Shuffle and pick 5
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const selected = pool.slice(0, 5).sort((a, b) => a - b);
      columns.push(selected);
    }

    // Convert columns to row-major order
    const card: number[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        card.push(columns[col][row]);
      }
    }

    // Set center as FREE
    card[FREE_INDEX] = -1;

    return card;
  }

  initializeGame(count: number): void {
    const newPlayers: PlayerCard[] = [];
    for (let i = 1; i <= count; i++) {
      const card = this.generateCard();
      // FREE space is auto-marked
      const initialMarked = new Set<number>([-1]);
      newPlayers.push({
        id: i,
        name: `Jugador ${i}`,
        numbers: card,
        markedNumbers: initialMarked,
        hasWon: false
      });
    }
    this.players.set(newPlayers);
    this.drawnNumbers.set([]);
    this.currentBall.set(null);
    this.winnerId.set(null);
    this.phase.set('host');

    // Save game state to localStorage
    this.saveGameState();
  }

  drawBall(): Promise<number> {
    return new Promise((resolve) => {
      if (this.drawnNumbers().length >= TOTAL_BALLS) {
        resolve(-1);
        return;
      }

      this.isDrawing.set(true);
      const drawn = new Set(this.drawnNumbers());
      let ball: number;

      do {
        ball = Math.floor(Math.random() * TOTAL_BALLS) + 1;
      } while (drawn.has(ball));

      // Simulate mixing animation delay
      setTimeout(() => {
        this.currentBall.set(ball);
        this.drawnNumbers.update(prev => [...prev, ball]);
        this.isDrawing.set(false);
        this.saveGameState();
        resolve(ball);
      }, 1800);
    });
  }

  /**
   * Get the BINGO letter for a given number.
   */
  getLetterForNumber(num: number): string {
    if (num <= 0) return '';
    for (let i = 0; i < BINGO_RANGES.length; i++) {
      if (num >= BINGO_RANGES[i][0] && num <= BINGO_RANGES[i][1]) {
        return BINGO_LETTERS[i];
      }
    }
    return '';
  }

  toggleMark(playerId: number, number: number): { action: 'marked' | 'unmarked'; won: boolean } {
    const players = this.players();
    const player = players.find(p => p.id === playerId);
    if (!player) return { action: 'marked', won: false };

    const updatedPlayers = players.map(p => {
      if (p.id !== playerId) return p;

      const newMarked = new Set(p.markedNumbers);
      let action: 'marked' | 'unmarked';

      if (newMarked.has(number)) {
        newMarked.delete(number);
        action = 'unmarked';
      } else {
        newMarked.add(number);
        action = 'marked';
      }

      // Win = 25 marked (24 numbers + FREE)
      const hasWon = newMarked.size === 25;

      return { ...p, markedNumbers: newMarked, hasWon };
    });

    this.players.set(updatedPlayers);

    const updatedPlayer = updatedPlayers.find(p => p.id === playerId)!;

    if (updatedPlayer.hasWon) {
      this.winnerId.set(playerId);
    }

    this.savePlayerState(playerId);

    return {
      action: updatedPlayer.markedNumbers.has(number) ? 'marked' : 'unmarked',
      won: updatedPlayer.hasWon
    };
  }

  markNumber(playerId: number, number: number): boolean {
    const players = this.players();
    const player = players.find(p => p.id === playerId);
    if (!player) return false;

    const updatedPlayers = players.map(p => {
      if (p.id !== playerId) return p;
      const newMarked = new Set(p.markedNumbers);
      newMarked.add(number);
      // Win = 25 marked (24 numbers + FREE)
      const hasWon = newMarked.size === 25;
      return { ...p, markedNumbers: newMarked, hasWon };
    });

    this.players.set(updatedPlayers);
    const updatedPlayer = updatedPlayers.find(p => p.id === playerId)!;

    if (updatedPlayer.hasWon) {
      this.winnerId.set(playerId);
    }

    this.savePlayerState(playerId);
    return updatedPlayer.hasWon;
  }

  unmarkNumber(playerId: number, number: number): void {
    // Cannot unmark FREE
    if (number === -1) return;

    const players = this.players();
    const updatedPlayers = players.map(p => {
      if (p.id !== playerId) return p;
      const newMarked = new Set(p.markedNumbers);
      newMarked.delete(number);
      return { ...p, markedNumbers: newMarked, hasWon: false };
    });

    this.players.set(updatedPlayers);
    if (this.winnerId() === playerId) {
      this.winnerId.set(null);
    }
    this.savePlayerState(playerId);
  }

  getPlayer(id: number): PlayerCard | undefined {
    return this.players().find(p => p.id === id);
  }

  saveGameState(): void {
    const state = {
      players: this.players().map(p => ({
        ...p,
        markedNumbers: Array.from(p.markedNumbers)
      })),
      drawnNumbers: this.drawnNumbers(),
      currentBall: this.currentBall(),
      winnerId: this.winnerId()
    };
    localStorage.setItem('bingo-game-state', JSON.stringify(state));
  }

  savePlayerState(playerId: number): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    const playerState = {
      id: player.id,
      numbers: player.numbers,
      markedNumbers: Array.from(player.markedNumbers),
      hasWon: player.hasWon
    };
    localStorage.setItem(`bingo-player-${playerId}`, JSON.stringify(playerState));
    this.saveGameState();
  }

  loadGameState(): boolean {
    const stateStr = localStorage.getItem('bingo-game-state');
    if (!stateStr) return false;

    try {
      const state = JSON.parse(stateStr);
      const players: PlayerCard[] = state.players.map((p: any) => ({
        ...p,
        markedNumbers: new Set<number>(p.markedNumbers)
      }));

      this.players.set(players);
      this.drawnNumbers.set(state.drawnNumbers || []);
      this.currentBall.set(state.currentBall);
      this.winnerId.set(state.winnerId);
      return true;
    } catch {
      return false;
    }
  }

  loadPlayerState(playerId: number): boolean {
    // First try to load the full game state
    const gameLoaded = this.loadGameState();
    if (!gameLoaded) return false;

    // Then check per-player overrides
    const playerStr = localStorage.getItem(`bingo-player-${playerId}`);
    if (playerStr) {
      try {
        const playerState = JSON.parse(playerStr);
        const players = this.players().map(p => {
          if (p.id !== playerId) return p;
          return {
            ...p,
            markedNumbers: new Set<number>(playerState.markedNumbers),
            hasWon: playerState.hasWon
          };
        });
        this.players.set(players);
      } catch {
        // ignore parse errors
      }
    }

    return !!this.getPlayer(playerId);
  }

  resetGame(): void {
    this.phase.set('setup');
    this.players.set([]);
    this.drawnNumbers.set([]);
    this.currentBall.set(null);
    this.winnerId.set(null);
    this.isDrawing.set(false);

    // Clear localStorage
    localStorage.removeItem('bingo-game-state');
    for (let i = 1; i <= 20; i++) {
      localStorage.removeItem(`bingo-player-${i}`);
    }
  }
}
