// Decoupled Event Bus & AtomOS Adapter Architecture (EVOL.md Section 1 & Section 5)

import { EVOLEvent } from '../../types/events';
import { IAtomOSAdapter } from '../../types/rpg';

type EventListener = (event: EVOLEvent) => void;

class EventBus {
  private listeners: EventListener[] = [];
  private adapter: IAtomOSAdapter;

  constructor(adapter: IAtomOSAdapter) {
    this.adapter = adapter;
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public emit(event: EVOLEvent): void {
    // Notify all client-side engine listeners
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error handling EVOL event:', err);
      }
    });

    // Forward post-commit notifications to external adapter if available
    if (this.adapter.isAvailable() && event.isPostCommitNotification) {
      if (event.type === 'MEMBER_CHECKED_IN') {
        this.adapter.simulateMemberCheckIn(event.memberId, event.gymId);
      } else if (event.type === 'WORKOUT_COMPLETED') {
        this.adapter.simulateWorkoutSync(event.memberId, event.workout);
      }
    }
  }

  public getAdapter(): IAtomOSAdapter {
    return this.adapter;
  }

  public setAdapter(adapter: IAtomOSAdapter): void {
    this.adapter = adapter;
  }
}

/**
 * Simulated Local Adapter (100% Standalone Client Operation - Not a live Atom OS server)
 */
export class SimulatedAtomOSAdapter implements IAtomOSAdapter {
  private connected: boolean = false;
  private facilityName: string = 'Local Standalone Simulation (Offline)';
  private activeMembers: number = 1;

  public isAvailable(): boolean {
    return this.connected;
  }

  public isSimulatedAdapter(): boolean {
    return true;
  }

  public async connect(facilityId: string): Promise<boolean> {
    this.connected = true;
    return true;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
  }

  public async simulateMemberCheckIn(_memberId: string, _facilityId: string): Promise<boolean> {
    return this.connected;
  }

  public async simulateWorkoutSync(_memberId: string, _workoutData: any): Promise<boolean> {
    return this.connected;
  }

  public getFacilityStatus() {
    return {
      connected: this.connected,
      isSimulated: true,
      facilityName: this.facilityName,
      activeMembersCount: this.activeMembers,
    };
  }
}

/**
 * Future Live AtomOS Adapter Stub
 * Explicitly reports unavailable until a live facility backend is configured and reachable.
 */
export class LiveAtomOSAdapter implements IAtomOSAdapter {
  private endpoint: string;
  private isConnected: boolean = false;

  constructor(endpoint: string = '') {
    this.endpoint = endpoint;
  }

  public isAvailable(): boolean {
    return this.isConnected;
  }

  public isSimulatedAdapter(): boolean {
    return false;
  }

  public async connect(_facilityId: string): Promise<boolean> {
    // Do not claim a successful live connection from an unconfigured stub
    this.isConnected = false;
    return false;
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  public async simulateMemberCheckIn(_memberId: string, _facilityId: string): Promise<boolean> {
    return false;
  }

  public async simulateWorkoutSync(_memberId: string, _workoutData: any): Promise<boolean> {
    return false;
  }

  public getFacilityStatus() {
    return {
      connected: false,
      isSimulated: false,
      facilityName: this.endpoint ? `Unconnected (${this.endpoint})` : 'Atom OS Not Connected',
      activeMembersCount: 0,
    };
  }
}

export const eventBus = new EventBus(new SimulatedAtomOSAdapter());
