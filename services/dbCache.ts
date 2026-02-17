
import { Partida } from '../types';

class DbCache {
    private cache: Partida[] | null = null;
    private lastFetch: number = 0;
    private CACHE_DURATION = 1000 * 60 * 5; // 5 minutos

    set(partidas: Partida[]) {
        this.cache = partidas;
        this.lastFetch = Date.now();
    }

    get(): Partida[] | null {
        if (this.cache && (Date.now() - this.lastFetch < this.CACHE_DURATION)) {
            return this.cache;
        }
        return null;
    }

    clear() {
        this.cache = null;
        this.lastFetch = 0;
    }
}

export const dbCache = new DbCache();
