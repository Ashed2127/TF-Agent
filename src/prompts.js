function buildPrompt(previousTopics, category) {
  const previousTopicsList = previousTopics.length > 0 
    ? previousTopics.map(t => `- ${t}`).join('\n')
    : '(none yet)';

  return `Generate business idea post in SIMPLE Amharic. Keep it SHORT but clear.

FORMAT:
🟢 <strong>Hybrid፡ [Name]</strong>

<strong>Value</strong> [2-3 short sentences]

<strong>How</strong> [2-3 short sentences]

<strong>@true_feed</strong>

EXAMPLE:
🟢 <strong>Hybrid፡ ለህፃናት አስተማሪ እቃ</strong>

<strong>Value</strong> ህፃናት እንዴት እንደሚማሩ ያውቃል . . . ትኩረት ይሰጣል . . . የእጅ እና የአይን ችሎታ ይሻሻላል

<strong>How</strong> ቀለል ያሉ ነገሮችን አንድ ላይ ይያዋሃዳል . . . ከቤት ውስጥ ያሉትን መጠቀም ይችላሉ . . . ገንዘብ ሳይወጣ መጀመር ይችላሉ

<strong>@true_feed</strong>

PREVIOUS TOPICS TO AVOID:
${previousTopicsList}

CATEGORY: ${category}

Generate post in Amharic. Keep sentences short and clear. MUST use at least 1-2 ". . ." for pauses in the entire post. NEVER use ። (Ethiopian period) - use ". . ." instead. Output ONLY from 🟢 to @true_feed.`;
}

module.exports = {
  buildPrompt
};