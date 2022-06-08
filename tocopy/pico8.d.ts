/** @noSelfInFile **/

declare type Color = number

declare function music(
  n?: number,
  fade_len?: number,
  channel_mask?: number,
): void
declare function sfx(
  n: number,
  channel?: number,
  offset?: number,
  length?: number,
): void
declare function camera(): void
declare function camera(x: number, y: number): void
declare function circ(x: number, y: number, r: number, col?: number): void
declare function circfill(x: number, y: number, r: number, col?: number): void
declare function clip(): void
declare function clip(
  x: number,
  y: number,
  w: number,
  h: number,
  clip_previous?: boolean,
): void
declare function cls(col?: number): void
declare function cursor(x: number, y: number): void
declare function fget(n: number, f?: number): number
declare function flip(): void
declare function fset(n: number, f: number, v?: boolean): void
declare function line(x0: number, y0: number): void
declare function line(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  col?: number,
): void
declare function pal(c0: Color, c1: Color, p?: number): void
declare function palt(col: number, t: boolean): void
declare function pget(x: number, y: number): number
declare function print(str: string): void
declare function print(str: string, x: number, y: number, col?: number): void
declare function pset(x: number, y: number): void
declare function rect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  col?: number,
): void
declare function rectfill(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  col?: number,
): void
declare function sget(x: number, y: number): number
declare function spr(n: number, x: number, y: number): void
declare function spr(
  n: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void
declare function spr(
  n: number,
  x: number,
  y: number,
  w: number,
  h: number,
  flip_x: boolean,
  flip_y: boolean,
): void
declare function sset(x: number, y: number, col: number): void
declare function sspr(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
): void
declare function sspr(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  flip_x?: boolean,
  flip_y?: boolean,
): void
declare function fillp(mask: number): void
declare function btn(i?: number, p?: number): boolean
declare function btnp(i?: number, p?: number): boolean
declare function map(
  cel_x: number,
  cel_y: number,
  sx: number,
  sy: number,
  cel_w: number,
  cel_h: number,
  layer?: number,
): void
declare function mapdraw(
  cel_x: number,
  cel_y: number,
  sx: number,
  sy: number,
  cel_w: number,
  cel_h: number,
  layer?: number,
): void
declare function mset(x: number, y: number, v?: number): void
declare function add(t: any, v: any, index?: number): void
declare function all(t: any): void
declare function count(t: any, v?: any[]): number
declare function del(t: any, v?: any): void
declare function deli(t: any, i?: any[]): void
declare function foreach(t: any, f: (item: any) => void): void
declare function abs(x: number): number
declare function atan2(dx: number, dy: number): number
declare function ceil(x: number): number
declare function cos(x: number): number
declare function flr(x: number): number
declare function max(x: number, y: number): number
declare function mid(x: number, y: number, z: number): number
declare function min(x: number, y: number): number
declare function rnd(x: number): number
declare function sgn(x: number): number
declare function sin(x: number): number
declare function srand(x: number): number
declare function sub(str: string, from: number, to?: number): string
declare function tostr(val: any, hex?: boolean): string
declare function tonum(str: string): number
declare function time(): number
declare function t(): number
declare function stat(x: number): void
declare function printh(
  str: string,
  filename?: string,
  overwrite?: boolean,
  save_to_desktop?: boolean,
): void
