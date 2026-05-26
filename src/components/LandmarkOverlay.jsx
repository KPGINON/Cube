const bones = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

export default function LandmarkOverlay({ landmarks }) {
  const hands = Array.isArray(landmarks?.[0]) ? landmarks : landmarks?.length ? [landmarks] : [];

  return (
    <svg className="landmark-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      {hands.flatMap((hand, handIndex) =>
        bones.map(([from, to]) => {
          const a = hand[from];
          const b = hand[to];
          if (!a || !b) return null;
          return (
            <line
              key={`${handIndex}-${from}-${to}`}
              x1={1 - a.x}
              y1={a.y}
              x2={1 - b.x}
              y2={b.y}
              vectorEffect="non-scaling-stroke"
            />
          );
        }),
      )}
      {hands.flatMap((hand, handIndex) =>
        hand.map((point, index) => (
          <circle key={`${handIndex}-${index}`} cx={1 - point.x} cy={point.y} r="0.012" vectorEffect="non-scaling-stroke" />
        )),
      )}
    </svg>
  );
}
