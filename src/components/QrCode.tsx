import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** Quiet zone around the code, in modules. Scanners need it. */
const MARGIN = 2;

/** A QR code as an SVG with one rect per dark module. */
export function QrCode({ text, size = 200 }: { text: string; size?: number }) {
  const code = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr;
  }, [text]);

  const count = code.getModuleCount();
  const total = count + MARGIN * 2;
  const cells = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (code.isDark(row, col)) {
        cells.push(<rect key={`${row}-${col}`} x={col + MARGIN} y={row + MARGIN} width={1} height={1} />);
      }
    }
  }

  return (
    <svg
      className="qr-code"
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={text}
    >
      <rect width={total} height={total} fill="#fff" />
      <g fill="#000">{cells}</g>
    </svg>
  );
}
