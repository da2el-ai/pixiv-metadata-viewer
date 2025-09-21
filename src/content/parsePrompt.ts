/**
 * プロンプト解析
 * メタデータからプロンプト情報を抽出する処理を担当
 */

/**
 * StableDiffusion/NovelAIのプロンプト情報を抽出
 */
export interface SummaryData {
  software?: string;
  prompt?: string;
  negative?: string;
  sampler?: string;
  steps?: string;
  cfg?: string;
  seed?: string;
  model?: string;
  size?: string;
}

/**
 * A1111方式
 */
const extractPromptA1111 = (parameters:any, summary:SummaryData) => {
  if (!parameters || !parameters.text) return;

  const params = parameters.text;
  console.log("[extractPromptA1111]", params);
  const negMatch = params.match(/Negative prompt:\s*([\s\S]*?)(?:\n[A-Z][\w ]+:\s|$)/i);
  if (negMatch) summary.negative = negMatch[1].trim();

  const paramsLine = (params.match(/^(?:.*?(?:Steps:|Sampler:|CFG|Seed|Model|Size).*?)$/gmi) || [])[0];
  if (paramsLine) {
    paramsLine.split(',').forEach((pair:string) => {
      const idx = pair.indexOf(':');
      if (idx === -1) return;
      const k = pair.slice(0, idx).trim().toLowerCase();
      const v = pair.slice(idx + 1).trim();
      if (k.startsWith('steps')) summary.steps = v;
      else if (k.startsWith('sampler')) summary.sampler = v;
      else if (k.startsWith('cfg')) summary.cfg = v;
      else if (k.startsWith('seed')) summary.seed = v;
      else if (k.startsWith('model')) summary.model = v;
      else if (k.includes('size')) summary.size = v;
    });
  }

  // ポジティブプロンプト（A1111）: "Negative prompt:"の前のすべて
  if (!summary.prompt && /Negative prompt:/i.test(params)) {
    const idx = params.search(/Negative prompt:/i);
    summary.prompt = params.slice(0, idx).trim();
  }
};


/**
 * NovelAI方式
 */
const extractPromptNAI = (comment: any, summary: SummaryData): void => {
  if (!comment || !comment.text) return;
  
  try {
    // JSON文字列をパース
    // 最初と最後の " を削除（JSONとして正しくパースするため）
    const jsonText = comment.text.trim();
    const jsonStr = jsonText.startsWith('"') && jsonText.endsWith('"') 
      ? jsonText.slice(1, -1) 
      : jsonText;
    
    // JSON文字列をパース（エスケープされた文字を処理）
    const jsonObj = JSON.parse(jsonStr.replace(/\\"/g, '"'));
    
    // 指定されたパスからプロンプト情報を抽出
    if (jsonObj.v4_prompt?.caption?.base_caption) {
      summary.prompt = jsonObj.v4_prompt.caption.base_caption;

      // キャラクタープロンプト
      if(jsonObj.v4_prompt?.caption?.char_captions){
        summary.prompt += "\n\nCharacter Prompt:\n";
        jsonObj.v4_prompt.caption.char_captions.forEach((charaCption: any) => {
          summary.prompt += "\n" + charaCption.char_caption + "\n";
        });
      }
    }
    
    if (jsonObj.v4_negative_prompt?.caption?.base_caption) {
      summary.negative = jsonObj.v4_negative_prompt.caption.base_caption;
    }
    
    // その他の情報も抽出
    if (jsonObj.sampler) summary.sampler = jsonObj.sampler;
    if (jsonObj.steps) summary.steps = String(jsonObj.steps);
    if (jsonObj.scale) summary.cfg = String(jsonObj.scale);
    if (jsonObj.seed) summary.seed = String(jsonObj.seed);
    if (jsonObj.height && jsonObj.width) summary.size = `${jsonObj.width}x${jsonObj.height}`;
    
    // ソフトウェア情報
    summary.software = 'NovelAI';
    
  } catch (e) {
    console.log('NovelAI JSONパースエラー:', e);
  }
};


/**
 * メタデータからプロンプト情報を抽出
 */
export function extractSummary(items: any[]): SummaryData {

    const summary: SummaryData = {
        software: "",
        prompt: undefined,
        negative: undefined,
        sampler: undefined,
        steps: undefined,
        cfg: undefined,
        seed: undefined,
        model: undefined,
        size: undefined
    };

    const parameters = items.find(item => item.keyword === 'parameters') || '';
    const comment = items.find(item => item.keyword === 'Comment') || '';

    if(parameters){
        extractPromptA1111(parameters, summary);
    }else if(comment){
        extractPromptNAI(comment, summary)
    }

//   // テキストを結合
//   const allText = items.map((e: any) => {
//     return `[${e.type}:${e.keyword}] ${e.text}`
//   }).join('\n');

//   // 何も見つからなかった場合は"parameters"ブロックを試す
//   const paramBlock = allText.match(/parameters\W([\s\S]+)$/i);
//   if (!summary.prompt && paramBlock) summary.prompt = paramBlock[1].trim();

  return summary;
}
