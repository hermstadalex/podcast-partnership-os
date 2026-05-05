import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { generateViralPostAssetsWithGemini as geminiGen } from '../src/lib/integrations/gemini';

async function main() {
  try {
    const res = await geminiGen("https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg", "React logo discussion");
    console.log("Success:", JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
main();
