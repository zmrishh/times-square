// Normalize low-contrast text colors only; artwork and surface colors stay intact.
import {readFile, writeFile} from "node:fs/promises";
const file="src/app/globals.css";
let css=await readFile(file,"utf8");
const luminance = hex => {
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*r+.7152*g+.0722*b;
};
css=css.replace(/(^\s*color:\s*)(#[a-f0-9]{6})(;)/gmi,(all,p,color,end)=>{
  const l=luminance(color);
  return l>.16 && l<.72 ? p+"#52615b"+end : all;
}).replace("--muted: #75818a", "--muted: #52615b");
await writeFile(file,css);
