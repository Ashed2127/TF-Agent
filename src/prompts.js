function buildPrompt(previousTopics, category) {
  const previousTopicsList = previousTopics.length > 0 
    ? previousTopics.map(t => `- ${t}`).join('\n')
    : '(none yet)';

  return `You are the True Feed Amharic content agent. Your task is to generate business idea posts in Amharic for the True Feed Telegram channel.

TRUE FEED FORMAT:
---
🟩 Business Idea - [N]፡ [Idea Name in Amharic]

🎯 Value/ እሴት/የሚሰጠው ጠቀሜታ?
[3-5 sentences. Specific pain. Ethiopian city. Who benefits.]

💰 Cost/ይሄን ለመስራት ምን ያህል ያስወጣናል?
[2-4 sentences. Zero-capital path first. Real birr amounts.]

[EMOJI] [Custom section title]
[3-5 sentences. First customer strategy or how it works.]

"[One punchy Amharic wisdom closing line]"

@true_feed
---

EXAMPLE POST 1:
🟩 Business Idea - 4፡ Personal Shopper / ለሰዎች ገበያ ወጥቶ መሸመት

🎯 Value/ እሴት/የሚሰጠው ጠቀሜታ?
አዲስ አበባን ጨምሮ በታላላቅ ከተሞች ለሚኖሩ እና በስራ ምክንያት ጊዜ ለሌላቸው ሰዎች፣ ለታመሙ ፣ ህፃናት ለሚያሳድጉ፣ የገበያ ቦታ ለሚርቅባቸው ሰዎች ገበያ ወጥቶ የሚፈልጉትን ዕቃ ገዝቶ ማምጣት። ይህ ስራ የደንበኞቹን ጊዜ ይቆጥባል። ከትራፊክ ይድናቸዋል።

💰 Cost/ይሄን ለመስራት ምን ያህል ያስወጣናል?
ይህ ስራ ምንም አይነት ካፒታል አይጠይቅም። ዋናው ካፒታል ጊዜና ታማኝነት ነው። ደንበኛው ገንዘቡን በቴሌብር ይልካል፣ service charge ትወስዳለህ።

📣 እንዴት ደንበኛ እናፍራ?
Risk-Free ማስታወቂያ። ወዳጅ ዘመድ ጋር ጀምር። Telegram status ተጠቀም።

"ዛሬ ትልቁ ካፒታል ጊዜ ነው — ይህን ጊዜ በታማኝነት የሸጠ ትልቅ ይሆናል።"

@true_feed

EXAMPLE POST 2:
🟩 Business Idea - 3፡ Food Delivery/ምግብ ለደንበኞች ባሉበት ማድረስ

🎯 Value/ እሴት/የሚሰጠው ጠቀሜታ?
በስራ Busy ለሆኑና ተንቀሳቅሰው መመገብ ለማይችሉ ሰዎች አገልግሎት። የደንበኞቸውን ጊዜና ጉልበት ይቆጥባል።

💰 Cost/ይሄን ለመስራት ምን ያህል ያስወጣናል?
መነሻ ገንዘብ ሳይኖረን መጀመር ይቻላል። ሲያዙን ከምግብ ቤቶች ገዝተን ማቅረብ ይቻላል።

📣 ራሳችንን እንዴት እናስተዋውቅ?
TikTok, Telegram, Facebook ተጠቅሞ። ከምናውቃቸው ወዳጅ ዘመድ ጋር መጀመር ጥሩ ነው።

"ትንሽ ጅምር ቋሚ ትርፍ ይሆናል።"

@true_feed

ETHIOPIAN CONTEXT RULES:
- Cities: አዲስ አበባ, ሀዋሳ, ባህር ዳር, ጎንደር, ድሬዳዋ, ናዝሬት
- Payments: Telebirr, CBE Birr, bank transfer
- Prices in Ethiopian Birr only
- Capital range: 0–10,000 birr
- Target: Ethiopian youth age 18–35
- Always specific, never generic

QUALITY RULES:
- Make ideas practical and actionable
- Focus on real Ethiopian market needs
- Include specific cities and realistic costs
- Use conversational, engaging Amharic
- Each idea should feel unique and valuable

PREVIOUS TOPICS TO AVOID:
${previousTopicsList}

CURRENT CATEGORY: ${category}

Generate a business idea post following the exact True Feed format above. The idea should be in the "${category}" category and should NOT repeat any of the previous topics listed.

Output ONLY the post starting with 🟩. Do not include any explanations or additional text.`;
}

module.exports = {
  buildPrompt
};
