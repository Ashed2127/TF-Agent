function buildPrompt(previousTopics, category) {
  const previousTopicsList = previousTopics.length > 0 
    ? previousTopics.map(t => `- ${t}`).join('\n')
    : '(none yet)';

  return `Generate SHORT business idea post in SIMPLE Amharic. Max 5 words per sentence.

FORMAT:
🟢 <strong>Business Idea - [N]፡ [Name]</strong>
🎯 Value: [1 short sentence]
🛠️  How: [1 short sentence]
<blockquote>[1 short insight]</blockquote>
<strong>@true_feed</strong>

EXAMPLE:
🟢 <strong>Business Idea - 1፡ ለህፃናት አስተማሪ እቃ</strong>
🎯 Value: ህፃናት በቀላሉ ይማራሉ . . . ትኩረት ይሰጣል
🛠️  How: ቀለል ያሉትን አንድ ላይ ያደርጋሉ . . . ገንዘብ ሳይወጣ
<blockquote>ለህፃናት ደህና መሆን አለባቸው</blockquote>
<strong>@true_feed</strong>

PREVIOUS TOPICS TO AVOID:
${previousTopicsList}

CATEGORY: ${category}

Generate SHORT post in Amharic. Max 5 words per sentence. Use ". . ." for pauses. Output ONLY from 🟢 to @true_feed.`;
}

module.exports = {
  buildPrompt
};