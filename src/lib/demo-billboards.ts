import { Creative,EMPTY_CREATIVE } from './registry';
/** User-provided preview clips. These are house inventory, never sponsors. */
export const DEMO_BILLBOARDS:Record<string,Creative>={
  'tsq-026':{...EMPTY_CREATIVE,name:'OpenAI clip · demo',url:'https://openai.com',mode:'video',image:'/demo/openai-preview.mp4',poster:'/demo/openai-preview.webp',description:'A 30-second preview excerpt supplied by the site owner. Demo artwork, not a paid sponsorship. This placement is available to buy.'},
  'tsq-009':{...EMPTY_CREATIVE,name:'Cluely clip · demo',url:'https://cluely.com',mode:'video',image:'/demo/cluely-preview.mp4',poster:'/demo/cluely-preview.webp',description:'A 30-second preview excerpt supplied by the site owner. Demo artwork, not a paid sponsorship. This placement is available to buy.'},
};
