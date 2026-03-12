import { Injectable, signal, computed } from '@angular/core';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase.config';

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
  readonly gameId = signal<string | null>(null);
  readonly phase = signal<GamePhase>('setup');
  readonly playerCount = signal<number>(2);
  readonly players = signal<PlayerCard[]>([]);
  readonly drawnNumbers = signal<number[]>([]);
  readonly currentBall = signal<number | null>(null);
  readonly isDrawing = signal<boolean>(false);
  readonly winnerId = signal<number | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly prize = signal<string>('');

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
   */
  generateCard(): number[] {
    const columns: number[][] = [];

    for (const [min, max] of BINGO_RANGES) {
      const pool: number[] = [];
      for (let n = min; n <= max; n++) {
        pool.push(n);
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const selected = pool.slice(0, 5).sort((a, b) => a - b);
      columns.push(selected);
    }

    const card: number[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        card.push(columns[col][row]);
      }
    }

    card[FREE_INDEX] = -1;
    return card;
  }

  async initializeGame(count: number, prizeValue: string = ''): Promise<string> {
    console.log('🎮 Inicializando juego con', count, 'jugadores');
    
    // Generate unique game ID
    const newGameId = crypto.randomUUID();
    this.gameId.set(newGameId);
    this.prize.set(prizeValue);
    console.log('🆔 Game ID generado:', newGameId);
    console.log('🏆 Premio:', prizeValue || 'Sin premio configurado');
    
    const newPlayers: PlayerCard[] = [];
    for (let i = 1; i <= count; i++) {
      const card = this.generateCard();
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

    console.log('💾 Guardando estado inicial en Firestore...');
    await this.saveGameStateToFirestore();
    console.log('✅ Juego inicializado correctamente');
    
    return newGameId;
  }

  drawBall(): Promise<number> {
    return new Promise((resolve) => {
      if (this.drawnNumbers().length >= TOTAL_BALLS) {
        console.log('⚠️ Todas las bolitas han sido sacadas');
        resolve(-1);
        return;
      }

      this.isDrawing.set(true);
      const drawn = new Set(this.drawnNumbers());
      console.log('🎲 Números ya sacados:', this.drawnNumbers().length, '/', TOTAL_BALLS);
      
      let ball: number;
      let attempts = 0;
      const maxAttempts = 100;

      do {
        ball = Math.floor(Math.random() * TOTAL_BALLS) + 1;
        attempts++;
        if (attempts > maxAttempts) {
          console.error('❌ Demasiados intentos para encontrar una bolita única');
          this.isDrawing.set(false);
          resolve(-1);
          return;
        }
      } while (drawn.has(ball));

      console.log('🎱 Nueva bolita:', ball, '(intento', attempts, ')');

      setTimeout(async () => {
        // Verificar duplicado antes de agregar
        if (this.drawnNumbers().includes(ball)) {
          console.error('❌ ERROR: Intento de duplicar el número', ball);
          this.isDrawing.set(false);
          resolve(-1);
          return;
        }
        
        this.currentBall.set(ball);
        this.drawnNumbers.update(prev => [...prev, ball]);
        this.isDrawing.set(false);
        
        console.log('✅ Bolita agregada. Total:', this.drawnNumbers().length);
        
        await this.saveGameStateToFirestore();
        resolve(ball);
      }, 700);
    });
  }

  getLetterForNumber(num: number): string {
    if (num <= 0) return '';
    for (let i = 0; i < BINGO_RANGES.length; i++) {
      if (num >= BINGO_RANGES[i][0] && num <= BINGO_RANGES[i][1]) {
        return BINGO_LETTERS[i];
      }
    }
    return '';
  }

  markNumber(playerId: number, number: number): boolean {
    const players = this.players();
    const player = players.find(p => p.id === playerId);
    if (!player) return false;

    const updatedPlayers = players.map(p => {
      if (p.id !== playerId) return p;
      const newMarked = new Set(p.markedNumbers);
      newMarked.add(number);
      const hasWon = newMarked.size === 25;
      return { ...p, markedNumbers: newMarked, hasWon };
    });

    this.players.set(updatedPlayers);
    const updatedPlayer = updatedPlayers.find(p => p.id === playerId)!;

    if (updatedPlayer.hasWon) {
      this.winnerId.set(playerId);
    }

    this.savePlayerMarksToFirestore(playerId);
    return updatedPlayer.hasWon;
  }

  unmarkNumber(playerId: number, number: number): void {
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
    this.savePlayerMarksToFirestore(playerId);
  }

  getPlayer(id: number): PlayerCard | undefined {
    return this.players().find(p => p.id === id);
  }

  async updatePlayerName(playerId: number, newName: string): Promise<void> {
    const players = this.players();
    const updatedPlayers = players.map(p => {
      if (p.id !== playerId) return p;
      return { ...p, name: newName };
    });

    this.players.set(updatedPlayers);
    await this.saveGameStateToFirestore();
    console.log('✅ Nombre actualizado para jugador', playerId, ':', newName);
  }

  // ─── Firestore: write ────────────────────────────────────────────────────────

  async saveGameStateToFirestore(): Promise<void> {
    try {
      const currentGameId = this.gameId();
      if (!currentGameId) {
        console.error('❌ No hay gameId activo');
        return;
      }
      
      console.log('🔥 Guardando en Firestore...');
      const state = {
        gameId: currentGameId,
        prize: this.prize(),
        players: this.players().map(p => ({
          id: p.id,
          name: p.name,
          numbers: p.numbers,
          markedNumbers: Array.from(p.markedNumbers),
          hasWon: p.hasWon
        })),
        drawnNumbers: this.drawnNumbers(),
        currentBall: this.currentBall(),
        winnerId: this.winnerId(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      console.log('📦 Datos a guardar:', state);
      await setDoc(doc(db, 'games', currentGameId), state);
      console.log('✅ Guardado exitoso en Firestore');
    } catch (error) {
      console.error('❌ Error al guardar en Firestore:', error);
      throw error;
    }
  }

  async savePlayerMarksToFirestore(playerId: number): Promise<void> {
    const player = this.getPlayer(playerId);
    const currentGameId = this.gameId();
    if (!player || !currentGameId) return;

    // Update only the players array in Firestore
    const updatedPlayers = this.players().map(p => ({
      id: p.id,
      name: p.name,
      numbers: p.numbers,
      markedNumbers: Array.from(p.markedNumbers),
      hasWon: p.hasWon
    }));

    await updateDoc(doc(db, 'games', currentGameId), {
      players: updatedPlayers,
      winnerId: this.winnerId(),
      updatedAt: Date.now()
    });
  }

  // ─── Firestore: read ─────────────────────────────────────────────────────────

  /**
   * Load full game state from Firestore once (for host restore or player init).
   * Returns true if the game exists and the given playerId is found.
   */
  async loadGameStateFromFirestore(gameId: string, playerId?: number): Promise<boolean> {
    try {
      this.gameId.set(gameId);
      const snap = await getDoc(doc(db, 'games', gameId));
      if (!snap.exists()) return false;

      this.applyFirestoreData(snap.data());

      if (playerId !== undefined) {
        return !!this.players().find(p => p.id === playerId);
      }
      return true;
    } catch (err) {
      console.error('Firestore load error:', err);
      return false;
    }
  }

  /**
   * Subscribe to real-time updates from Firestore.
   * Returns the unsubscribe function – call it in ngOnDestroy.
   */
  subscribeToGameState(gameId: string, onUpdate?: () => void): Unsubscribe {
    this.gameId.set(gameId);
    return onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) {
        this.applyFirestoreData(snap.data());
        onUpdate?.();
      }
    });
  }

  private applyFirestoreData(data: any): void {
    const players: PlayerCard[] = (data['players'] || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      numbers: p.numbers,
      markedNumbers: new Set<number>(p.markedNumbers),
      hasWon: p.hasWon
    }));

    this.players.set(players);
    this.drawnNumbers.set(data['drawnNumbers'] || []);
    this.currentBall.set(data['currentBall'] ?? null);
    this.winnerId.set(data['winnerId'] ?? null);
    this.prize.set(data['prize'] || '');
    if (data['gameId']) {
      this.gameId.set(data['gameId']);
    }
  }

  // ─── Legacy localStorage (kept for backward compat / offline fallback) ───────

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

  async resetGame(): Promise<void> {
    this.phase.set('setup');
    this.players.set([]);
    this.drawnNumbers.set([]);
    this.currentBall.set(null);
    this.winnerId.set(null);
    this.isDrawing.set(false);
    this.gameId.set(null);

    localStorage.removeItem('bingo-game-state');

    // Note: No need to delete from Firestore, old games can remain
  }
}
