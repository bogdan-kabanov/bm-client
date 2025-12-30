type Listener = () => void;

class TradingStore {
    intervalMs = 60000;
    isDropdownOpen = false;
    isDurationDropdownOpen = false;
    isTradingActive = false;
    chartFlash = {
        active: false,
        color: '#37a1ff',
        timeoutId: null as NodeJS.Timeout | null
    };
    priceDifferenceFlash: {color: 'green' | 'red', timestamp: number} | undefined = undefined;
    priceDifferenceTimeoutId: NodeJS.Timeout | null = null;
    newTransactions = new Set<number>();
    private listeners = new Set<Listener>();

    constructor() {
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify(): void {
        this.listeners.forEach(listener => listener());
    }

    setIntervalMs(value: number) {
        this.intervalMs = value;
        this.notify();
    }

    toggleDropdown() {
        this.isDropdownOpen = !this.isDropdownOpen;
        this.notify();
    }

    toggleDurationDropdown() {
        this.isDurationDropdownOpen = !this.isDurationDropdownOpen;
        this.notify();
    }

    closeDropdown() {
        this.isDropdownOpen = false;
        this.notify();
    }

    closeDurationDropdown() {
        this.isDurationDropdownOpen = false;
        this.notify();
    }

    setTradingActive(active: boolean) {
        this.isTradingActive = active;
        this.notify();
    }

    triggerChartFlash(color: string) {
        this.chartFlash.active = true;
        this.chartFlash.color = color;

        if (this.chartFlash.timeoutId) {
            clearTimeout(this.chartFlash.timeoutId);
        }

        this.chartFlash.timeoutId = setTimeout(() => {
            this.chartFlash.active = false;
            this.notify();
        }, 1000);
        this.notify();
    }

    triggerPriceDifferenceFlash(color: 'green' | 'red') {
        if (this.priceDifferenceTimeoutId) {
            clearTimeout(this.priceDifferenceTimeoutId);
        }

        this.priceDifferenceFlash = { color, timestamp: Date.now() };
        this.priceDifferenceTimeoutId = setTimeout(() => {
            this.priceDifferenceFlash = undefined;
            this.notify();
        }, 600);
        this.notify();
    }

    addNewTransaction(id: number) {
        this.newTransactions.add(id);
        setTimeout(() => {
            this.newTransactions.delete(id);
            this.notify();
        }, 5000);
        this.triggerPriceDifferenceFlash('green');
    }

    isNewTransaction(id: number): boolean {
        return this.newTransactions.has(id);
    }
}

export const tradingStore = new TradingStore();