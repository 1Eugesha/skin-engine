// Типы SkinEngine © 1Eugesha · MIT

export interface SkinEngineOptions {
  /** URL текстуры скина (можно позже через setSkin) */
  skin?: string;
  width?: number;
  height?: number;
  fov?: number;
  zoom?: number;
  /** живая стойка после загрузки (по умолчанию true) */
  idle?: boolean;
  /** случайные анимации-оживители в idle, раз в ~8 с (по умолчанию true) */
  gestures?: boolean;
  /** нейм-тег над головой */
  nameTag?: string | null;
  /** высота нейм-тега над моделью (по умолчанию 21.5) */
  nameTagHeight?: number;
  /** клики/тапы = отклик (по умолчанию true) */
  interactive?: boolean;
  /** голова следит за курсором (по умолчанию true) */
  lookFollow?: boolean;
  /** интро-появление модели (по умолчанию true) */
  intro?: boolean;
  /** стартовый разворот модели, рад (по умолчанию 0.14) */
  initialYaw?: number;
  /** кроссфейд режимов, с (по умолчанию 0.45) */
  xfade?: number;
  /** разворот при смене скина (по умолчанию true) */
  skinSwapFx?: boolean;
  spinDur?: number;
  /** витринный свет rim + fill (по умолчанию true) */
  lights?: boolean;
  /** URL плаща */
  cape?: string;
  /** тип модели: "auto" (по текстуре), "wide" (classic) или "slim" */
  model?: "auto" | "wide" | "slim";
  /** плотность рендера; 0 = авто clamp(dpr, 1.5..2.5) */
  pixelRatio?: number;
  clickMaxEnergy?: number;
  clickEnergyPerHit?: number;
  clickDecay?: number;
  damageFlash?: number;
  damageDecay?: number;
  tapMoveThreshold?: number;
  tapTimeThreshold?: number;
}

/** Формат анимации: канал -> ключи [тик, значение], 20 тиков = 1 с */
export interface AnimData {
  loop?: boolean;
  begin?: number;
  end?: number;
  ret?: number;
  stop?: number;
  tracks: Record<string, Array<[number, number]>>;
}

export type StageEvent = "ready" | "hit" | "damage" | "emoteend" | "skinchange" | "skin" | "model";

export declare class SkinStage {
  constructor(canvas: HTMLCanvasElement, opts?: SkinEngineOptions);
  readonly ready: Promise<SkinStage>;
  mode: "loading" | "idle" | "walk" | "stand" | "emote" | "disposed";
  readonly damage: number;
  /** текущий тип модели */
  readonly model: "wide" | "slim" | null;
  /** программный рендер (нет аппаратного ускорения) */
  readonly software: boolean;

  idle(): this;
  walk(): this;
  stand(): this;
  play(data: AnimData): this;
  stop(): this;
  setSkin(url: string): Promise<this>;
  setModel(type: "wide" | "slim"): this;
  setCape(url: string): this;
  clearCape(): this;
  setElytra(url: string): this;
  setEars(url: string): this;
  setNameTag(name: string | null): this;
  hit(power?: number): this;
  damageFlash(): this;
  setInteractive(on: boolean): this;
  setPaused(on: boolean): this;
  /** PNG (dataURL) текущего кадра */
  snapshot(type?: string, quality?: number): string | null;
  on(ev: StageEvent, cb: (arg?: unknown) => void): this;
  off(ev: StageEvent, cb: (arg?: unknown) => void): this;
  dispose(): void;
}

export interface SkinEngineAPI {
  version: string;
  author: string;
  Stage: typeof SkinStage;
  mount(canvas: HTMLCanvasElement, opts?: SkinEngineOptions): SkinStage;
  /** промис загрузки skinview3d */
  load(): Promise<unknown>;
  /** "hardware" | "software" | "none" */
  gpu(): string;
  /** URL плаща игрока по нику (или null) */
  loadCape(nick: string): Promise<string | null>;
  defaults: Required<SkinEngineOptions>;
  // низкоуровневые примитивы
  ensureRig(player: unknown): unknown;
  restPose(player: unknown): void;
  applyPose(skin: unknown, data: { tracks: Record<string, unknown> }, gv: (key: string) => number): void;
  applyAnimTick(skin: unknown, data: AnimData, tick: number): void;
  sampleTrack(points: Array<[number, number]>, t: number): number;
  fixTransparency(player: unknown): void;
  applyDamageTint(player: unknown, amount: number): void;
  resetDamageTint(player: unknown): void;
  AnimPlayer(skinview3d?: unknown): unknown;
}

declare global {
  interface Window {
    SkinEngine: SkinEngineAPI;
    /** опциональный пак анимаций (skin-engine.anims.js) */
    SkinEngineAnims?: Record<string, AnimData>;
  }
  interface HTMLElementTagNameMap {
    /** <skin-viewer nick="..."> — персонаж без единой строки JS */
    "skin-viewer": HTMLElement;
  }
}

declare const SkinEngine: SkinEngineAPI;
export default SkinEngine;
