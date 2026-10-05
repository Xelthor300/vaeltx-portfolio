"use client";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Player } from "@remotion/player";
import { useSyncExternalStore } from "react";

function subscribe(fn: () => void) {
  const q = window.matchMedia("(prefers-reduced-motion: reduce)");
  q.addEventListener("change", fn);
  return () => q.removeEventListener("change", fn);
}
function Structure({ progress = 1 }: { progress?: number }) {
  return (
    <div
      className="au-wireframe"
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 25}px)`,
      }}
    >
      <div className="au-wire-top">
        <span />
        <span />
        <span />
        <b>YOUR NEXT CHAPTER</b>
      </div>
      <div className="au-wire-body">
        <span className="au-wire-label">A WEBSITE WITH PURPOSE</span>
        <div className="au-wire-heading">
          Built around
          <br />
          your business.
        </div>
        <div className="au-wire-line" />
        <div className="au-wire-line short" />
        <div className="au-wire-button">A clear next step ↗</div>
        <div className="au-wire-cards">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="au-wire-foot">DESIGN · DEVELOPMENT · LAUNCH</div>
    </div>
  );
}
function Composition() {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 40], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: 24 }}>
      <Structure progress={progress} />
    </AbsoluteFill>
  );
}
export default function AuctionMotion() {
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  return (
    <div className="au-motion" aria-hidden="true">
      {reduced ? (
        <div className="au-motion-static">
          <Structure />
        </div>
      ) : (
        <Player
          component={Composition}
          durationInFrames={90}
          fps={30}
          compositionWidth={600}
          compositionHeight={440}
          autoPlay
          controls={false}
          loop={false}
          moveToBeginningWhenEnded={false}
          style={{ width: "100%" }}
        />
      )}
    </div>
  );
}
