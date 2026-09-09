function buildPrompt(previousTopics, category) {
  const previousTopicsList = previousTopics.length > 0 
    ? previousTopics.map(t => `- ${t}`).join('\n')
    : '(none yet)';

  return `Generate a business idea post in SIMPLE Amharic (12-year-old level). Use ". . ." for pauses, NOT ። ፣.

FORMAT:
🟢 <strong>Business Idea - [N]፡ [Name]</strong>
🎯 Value/ እሴት/የሚሰጠው ጠቀሜታ?
[2-3 sentences with Ethiopian cities]
🛠️  How it works/እንዴት ይሰራል?
[2-3 sentences]
<blockquote>[Key insight]</blockquote>
<strong>@true_feed</strong>

EXAMPLE:
🟢 <strong>Business Idea - 1፡ ለህፃናት አስተማሪ እቃ</strong>
🎯Value/ እሴት/የሚሰጠው ጠቀሜታ?
ህፃናት እንዴት እንደሚማሩ ያውቃል . . . ትኩረት ይሰጣል . . . የእጅ እና የአይን ችሎታ ይሻሻላል
🛠️  How it works/እንዴት ይሰራል?
ቀለል ያሉ ነገሮችን አንድ ላይ ይያዋሃዳል . . . ከቤት ውስጥ ያሉትን መጠቀም ይችላሉ . . . ገንዘብ ሳይወጣ መጀመር ይችላሉ
<blockquote>ህፃናት አንድ ነገር ላይ ብቻ ትኩረት እንዲያረጉ ይህን መሳሪያ መስራት ይችላሉ . . . ግን ለህፃናቱ ደህና መሆን አለባቸው</blockquote>
<strong>@true_feed</strong>

PREVIOUS TOPICS TO AVOID:
${previousTopicsList}

CATEGORY: ${category}

Generate a business idea post in SIMPLE Amharic following the format above. Include Ethiopian cities like አዲስ አበባ, ሀዋሳ, etc. Use ". . ." for pauses, NOT ። ፣. Output ONLY the complete post from 🟢 to @true_feed.`;
}

module.exports = {
  buildPrompt
};