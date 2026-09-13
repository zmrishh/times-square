// Original canvas illustrations, not sponsor identities or fabricated activity.
const TITLES = [
  "CITY\nIN COLOR",
  "LOOK\nALIVE",
  "HELLO,\nDAYDREAM",
  "A NEW\nPERSPECTIVE",
  "PLAY\nOUTSIDE",
  "NIGHT\n& DAY",
  "SMALL\nWONDERS",
  "OPEN\nYOUR EYES",
  "GOOD\nENERGY",
  "MAKE\nBELIEVE",
  "STAY\nCURIOUS",
  "SIDE\nBY SIDE",
  "AFTER\nHOURS",
  "GO\nSOMEWHERE",
  "THE\nBIG PICTURE",
  "ALL\nTOGETHER",
  "FRESH\nEYES",
  "ON THE\nBRIGHT SIDE",
  "MAKE\nWAVES",
  "JUST\nIMAGINE",
  "COLOR\nTHE CITY",
  "SLOW\nMOTION",
  "A LITTLE\nMAGIC",
  "MEET\nTHE MOMENT",
];
export function drawHouse(
  ctx: CanvasRenderingContext2D,
  art: number,
  w: number,
  h: number,
  bg: string,
  fg: string,
) {
  const m = Math.min(w, h) * 0.06;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;
  ctx.textBaseline = "top";
  if (w / h > 5) {
    ctx.font = `800 ${h * 0.39}px Arial`;
    const text = [
      "PAPER SQUARE  /  IDEAS IN MOTION",
      "COLOR OUTSIDE THE LINES",
      "THE CITY IS AN OPEN SKETCHBOOK",
      "A LITTLE NEW YORK FOR EVERYONE",
    ][art % 4];
    ctx.fillText(text, m, h * 0.17, w - m * 2);
    ctx.font = `600 ${h * 0.15}px Arial`;
    ctx.fillText("HOUSE ART  ·  UNSOLD", m, h * 0.72);
    return;
  }
  const wide = w / h > 1.7;
  const r = Math.min(w * (wide ? 0.22 : 0.38), h * 0.22);
  const cx = wide ? w * 0.76 : w * 0.5,
    cy = wide ? h * 0.48 : h * 0.38;
  ctx.save();
  ctx.translate(cx, cy);
  const type = art % 10;
  if (type === 0) {
    // Sun / hand-cut rays.
    for (let i = 0; i < 16; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 8);
      ctx.fillRect(r * 0.65, -r * 0.055, r * 0.5, r * 0.11);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 1) {
    // Paper flower.
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 4);
      ctx.beginPath();
      ctx.ellipse(r * 0.55, 0, r * 0.5, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 2) {
    // Watching eyes.
    for (const x of [-0.52, 0.52]) {
      ctx.fillStyle = "#fff4df";
      ctx.beginPath();
      ctx.ellipse(x * r, 0, r * 0.46, r * 0.66, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(x * r + r * 0.12, 0, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 3) {
    // Radiating architectural arches.
    ctx.lineWidth = r * 0.105;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(0, r * 0.55, r * (0.3 + i * 0.19), Math.PI, 0);
      ctx.lineTo(r * (0.3 + i * 0.19), r);
      ctx.stroke();
    }
  } else if (type === 4) {
    // Checker / optical poster.
    for (let y = -3; y < 3; y++)
      for (let x = -3; x < 3; x++)
        if ((x + y) % 2 === 0)
          ctx.fillRect((x * r) / 3, (y * r) / 3, r / 3, r / 3);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.44, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 5) {
    // Crescent and orbit.
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(r * 0.4, -r * 0.3, r * 0.77, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(r * 0.75, -r * 0.75, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 6) {
    // Paper airplane.
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.65);
    ctx.lineTo(r, r * 0.05);
    ctx.lineTo(-r * 0.35, r);
    ctx.lineTo(-r * 0.23, r * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = bg;
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.moveTo(-r * 0.23, r * 0.12);
    ctx.lineTo(r, r * 0.05);
    ctx.stroke();
  } else if (type === 7) {
    // Ink skyline.
    for (let i = 0; i < 7; i++) {
      const bh = r * (0.6 + ((i * 3 + art) % 7) / 6);
      ctx.fillRect((i - 3.5) * r * 0.28, r - bh, r * 0.21, bh);
    }
    ctx.beginPath();
    ctx.arc(r * 0.5, -r * 0.65, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 8) {
    // Layered cut-paper disks.
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? bg : fg;
      ctx.beginPath();
      ctx.arc((i % 2) * r * 0.17, 0, r * (1 - i * 0.17), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Asterisk.
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 6);
      ctx.fillRect(-r, -r * 0.14, r * 2, r * 0.28);
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.fillStyle = fg;
  ctx.font = `600 ${Math.min(w, h) * 0.035}px Arial`;
  ctx.fillText(
    `PAPER SQUARE / STUDY ${String(art + 1).padStart(2, "0")}`,
    m,
    m,
    w - m * 2,
  );
  const title = TITLES[art % TITLES.length].split("\n");
  let size = Math.min(w * (wide ? 0.1 : 0.17), h * (wide ? 0.2 : 0.115));
  const maxWidth = wide ? w * 0.49 : w - m * 2;
  while (size > 4) {
    ctx.font = `900 ${size}px Arial`;
    if (title.every((t) => ctx.measureText(t).width <= maxWidth)) break;
    size--;
  }
  const ty = wide ? h * 0.3 : h * 0.68;
  title.forEach((t, i) => ctx.fillText(t, m, ty + i * size * 0.95));
  ctx.font = `600 ${Math.min(w, h) * 0.028}px Arial`;
  ctx.fillText("HOUSE ART · UNSOLD", m, h - m * 1.4, w - m * 2);
}
