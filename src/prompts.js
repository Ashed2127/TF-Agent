function buildPrompt(previousTopics, category) {
  const previousTopicsList = previousTopics.length > 0 
    ? previousTopics.map(t => `- ${t}`).join('\n')
    : '(none yet)';

  return `Generate business idea post in SIMPLE Amharic. Keep it SHORT but clear.

FORMAT:
🟢 <strong>Hybrid - [N]፡ [Name]</strong>
Value: [2-3 short sentences]
How: [2-3 short sentences]
<strong>@true_feed</strong>

EXAMPLE:
🟢 <strong>Hybrid - 1፡ ለህፃናት አስተማሪ እቃ</strong>
Value: ህፃናት እንዴት እንደሚማሩ ያውቃል . . . ትኩረት ይሰጣል . . . የእጅ እና የአይን ችሎታ ይሻሻላል
How: ቀለል ያሉ ነገሮችን አንድ ላይ ይያዋሃዳል . . . ከቤት ውስጥ ያሉትን መጠቀም ይችላሉ . . . ገንዘብ ሳይወጣ መጀመር ይችላሉ
<strong>@true_feed</strong>

PREVIOUS TOPICS TO AVOID:
${previousTopicsList}

CATEGORY: ${category}

Generate post in Amharic. Keep sentences short and clear. MUST use at least 1-2 ". . ." for pauses in the entire post. NEVER use ። (Ethiopian period) - use ". . ." instead. Output ONLY from 🟢 to @true_feed.`;
}

module.exports = {
  buildPrompt
};