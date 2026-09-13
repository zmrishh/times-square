import { Creative, HOUSE } from "./registry";
import { drawHouse } from "./house-art";

function image(
  src: string,
  longestSide = 2048,
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const im = new Image();
    im.crossOrigin = "anonymous";
    const finish = (result: HTMLImageElement | null) => {
      clearTimeout(timer);
      im.onload = null;
      im.onerror = null;
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), 15000);
    im.onload = () => finish(im);
    im.onerror = () => finish(null);
    const size = [256, 512, 1024, 2048].find((n) => n >= longestSide) || 2048;
    im.src = src.startsWith("/api/assets/") ? `${src}?size=${size}` : src;
  });
}
function drawFit(
  ctx: CanvasRenderingContext2D,
  im: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fit = "contain",
  cx = 50,
  cy = 50,
) {
  const s =
    fit === "cover"
      ? Math.max(w / im.width, h / im.height)
      : Math.min(w / im.width, h / im.height);
  const iw = im.width * s,
    ih = im.height * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(
    im,
    x + ((w - iw) * cx) / 100,
    y + ((h - ih) * cy) / 100,
    iw,
    ih,
  );
  ctx.restore();
}
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const all: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > width && line) {
        all.push(line);
        line = "";
      }
      for (const char of (line ? " " : "") + word) {
        if (ctx.measureText(line + char).width > width && line) {
          all.push(line);
          line = "";
        }
        line += char;
      }
    }
    all.push(line);
  }
  return all;
}
export async function renderCreative(
  canvas: HTMLCanvasElement,
  creative: Creative | null,
  art: number,
  width = 1200,
  height = 800,
) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const house = HOUSE[art % HOUSE.length];
  const c = creative;
  const bg = c?.bg || house.bg,
    fg = c?.fg || house.fg;
  if (!c) {
    drawHouse(ctx, art, width, height, bg, fg);
    return;
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  if (c.mode === "upload" || c.mode === "video") {
    const source = c.mode === "video" ? c.poster || "" : c.image;
    const im = await image(source, Math.max(width, height));
    if (im) drawFit(ctx, im, 0, 0, width, height, c.fit, c.cropX, c.cropY);
    else {
      ctx.fillStyle = "#f7f3e8";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#25231f";
      ctx.textAlign = "center";
      ctx.font = `600 ${Math.max(12, Math.min(width / 24, height / 8))}px Arial`;
      ctx.fillText(source ? "Artwork unavailable" : "Your upload fills this billboard", width / 2, height / 2, width * 0.9);
      ctx.textAlign = "start";
    }
    return;
  }
  const margin = Math.min(width, height) * 0.085;
  if (!c) {
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = fg;
    ctx.lineWidth = Math.max(2, width * 0.003);
    if (house.style === 2) {
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.ellipse(
          width * 0.92,
          height * 0.68,
          width * (0.18 + i * 0.05),
          height * (0.3 + i * 0.08),
          -0.4,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    } else if (house.style === 3) {
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(
          width * (0.9 - i * 0.025),
          height * 0.1,
          width * (0.1 + i * 0.045),
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = fg;
  ctx.textBaseline = "top";
  let nameSize = Math.max(14, Math.min(width, height) * 0.035);
  const name = c?.name || "PAPER SQUARE";
  const maxNameWidth =
    width - margin * 2 - (c?.logo ? Math.min(width, height) * 0.2 : 0);
  do {
    ctx.font = `600 ${nameSize}px Arial`;
    if (ctx.measureText(name).width <= maxNameWidth) break;
    nameSize--;
  } while (nameSize > 10);
  ctx.fillText(name, margin, margin);
  const logo = await image(c?.logo || "", Math.min(width, height) * 0.2);
  if (logo)
    drawFit(
      ctx,
      logo,
      width - margin - Math.min(width, height) * 0.17,
      margin,
      Math.min(width, height) * 0.17,
      Math.min(width, height) * 0.14,
    );
  const text = c?.headline || house.name;
  let size = Math.min(width * 0.13, height * 0.23);
  let wrapped: string[] = [];
  do {
    ctx.font = `800 ${size}px Arial`;
    wrapped = lines(ctx, text, width - margin * 2);
    if (
      wrapped.length * size * 1.01 < height * 0.61 &&
      wrapped.every((l) => ctx.measureText(l).width <= width - margin * 2)
    )
      break;
    size -= 2;
  } while (size > 14);
  const y = height * 0.22;
  wrapped.forEach((l, i) => ctx.fillText(l, margin, y + i * size * 1.01));
  const sub = c ? c.subline : house.sub;
  let subSize = Math.max(12, Math.min(width, height) * 0.033),
    subLines: string[] = [];
  do {
    ctx.font = `600 ${subSize}px Arial`;
    subLines = lines(ctx, sub, width - margin * 2);
    if (subLines.length <= 2) break;
    subSize--;
  } while (subSize > 8);
  subLines.forEach((l, i) =>
    ctx.fillText(l, margin, height - margin * 1.8 + i * subSize * 1.15),
  );
  let domain = "HOUSE ART · AVAILABLE TO CLAIM";
  if (c) {
    try {
      domain = new URL(c.url).hostname;
    } catch {
      domain = "YOUR WEBSITE";
    }
  }
  let domainSize = Math.max(11, Math.min(width, height) * 0.024);
  do {
    ctx.font = `500 ${domainSize}px Arial`;
    if (ctx.measureText(domain).width <= width - margin * 2) break;
    domainSize--;
  } while (domainSize > 7);
  ctx.fillText(domain, margin, height - margin * 0.48);
}
