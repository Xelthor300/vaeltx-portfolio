// Anchor server time to the monotonic browser clock; wall-clock changes cannot reset it.
export function serverClockOffset(serverTime: string,requestStart: number,responseEnd: number) {
  return Date.parse(serverTime)+(responseEnd-requestStart)/2-responseEnd;
}
export function remainingSeconds(deadline: string,monotonicNow: number,offset: number) {
  return Math.max(0,Math.floor((Date.parse(deadline)-monotonicNow-offset)/1000));
}
export function countdownCells(seconds: number) {
  return [Math.floor(seconds/86400),Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60];
}
