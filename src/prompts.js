function buildPrompt(previousTopics, category) {
  const previousTopicsList = previousTopics.length > 0 
    ? previousTopics.map(t => `- ${t}`).join('\n')
    : '(none yet)';

  return `Generate business idea post in SIMPLE Amharic. Keep it SHORT but clear.

FORMAT:
🟢 <strong>Hybrid፡ [Name]</strong>

<strong>Value</strong> [at least 5 lines of deep insightful idea]

<strong>@true_feed</strong>

EXAMPLE:
🟢 <strong>Hybrid፡ ለህፃናት አስተማሪ እቃ</strong>

<strong>Value</strong> ህፃናት እንዴት እንደሚማሩ ያውቃል፣ ትኩረት ይሰጣል የእጅ እና የአይን ችሎታ ይሻሻላል
እያንዳንዱ እቃ የተለየ ትምህርት ያስተምራል፣ ከትዳር ጀምሮ የሚያዳብር መሆን አለበት አዳዲስ ነገሮችን ማግኘት ይፈልጋል
ግልፅ እና ቀላል መሆን አለበት የህፃናት አንግስት ማስተምር ይችላል የእውነተኛ ኑሮ ችሎታዎችን ይሻሻላል

<strong>@true_feed</strong>

PREVIOUS TOPICS TO AVOID:
${previousTopicsList}

CATEGORY: ${category}

Generate post in Amharic. Keep sentences short and clear. Focus on Value section with at least 5 lines of deep insightful content. Output ONLY from 🟢 to @true_feed.`;
}

module.exports = {
  buildPrompt
};