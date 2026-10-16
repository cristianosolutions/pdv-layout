// Coordinates are in project pixels; the attraction distance stays constant on screen.
export function snapAxis(position: number, length: number, pageLength: number, zoom: number) {
  const candidates = [
    { position: 0, guide: 0 },
    { position: (pageLength - length) / 2, guide: pageLength / 2 },
    { position: pageLength - length, guide: pageLength },
  ];
  const closest = candidates.reduce((best, candidate) =>
    Math.abs(candidate.position - position) < Math.abs(best.position - position) ? candidate : best,
  );
  return Math.abs(closest.position - position) <= 8 / zoom
    ? closest
    : { position, guide: null };
}
