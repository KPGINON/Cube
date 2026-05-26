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
  return (
    <svg className="landmark-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      {bones.map(([from, to]) => {
        const a = landmarks[from];
        const b = landmarks[to];
        if (!a || !b) return null;
        return (
          <line
            key={`${from}-${to}`}
            x1={1 - a.x}
            y1={a.y}
            x2={1 - b.x}
            y2={b.y}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {landmarks.map((point, index) => (
        <circle key={index} cx={1 - point.x} cy={point.y} r="0.012" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
