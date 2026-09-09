function buildPrompt(previousTopics, category) {
  const previousTopicsList = previousTopics.length > 0 
    ? previousTopics.map(t => `- ${t}`).join('\n')
    : '(none yet)';

  return `Generate business idea post in SIMPLE Amharic. Keep it SHORT but clear.

FORMAT:
🟢 <strong>Business Idea - [N]፡ [Name]</strong>
🎯 Value: [2-3 short sentences]
🛠️  How: [2-3 short sentences]
<blockquote>[1 short insight]</blockquote>
<strong>@true_feed</strong>

EXAMPLE:
🟢 <strong>Business Idea - 1፡ ለህፃናት አስተማሪ እቃ</strong>
🎯 Value: ህፃናት እንዴት እንደሚማሩ ያውቃል . . . ትኩረት ይሰጣል . . . የእጅ እና የአይን ችሎታ ይሻሻላል
🛠️  How: ቀለል ያሉ ነገሮችን አንድ ላይ ይያዋሃዳል . . . ከቤት ውስጥ ያሉትን መጠቀም ይችላሉ . . . ገንዘብ ሳይወጣ መጀመር ይችላሉ
<blockquote>ህፃናት አንድ ነገር ላይ ብቻ ትኩረት እንዲያረጉ ይህን መሳሪያ መስራት ይችላሉ . . . ግን ለህፃናቱ ደህና መሆን አለባቸው</blockquote>
<strong>@true_feed</strong>

PREVIOUS TOPICS TO AVOID:
${previousTopicsList}

CATEGORY: ${category}

Generate post in Amharic. Keep sentences short and clear. Use ". . ." for pauses. Output ONLY from 🟢 to @true_feed.`;
}

module.exports = {
  buildPrompt
};