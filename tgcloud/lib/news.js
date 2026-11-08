import { fetch } from 'sdk';
import { OPENROUTER_API_KEY } from './secrets.js';
import { getCustomSources, getContentStructure, getUserByTelegramId } from './database.js';

export const SUPPORTED_LANGUAGES = {
  am: { code: 'am', name: 'Amharic', label: '🇪🇹 አማርኛ (Amharic)', flag: '🇪🇹' },
  ti: { code: 'ti', name: 'Tigrinya', label: '🇪🇹 ትግርኛ (Tigrinya)', flag: '🇪🇹' },
  om: { code: 'om', name: 'Afaan Oromo', label: '🇪🇹 Afaan Oromoo', flag: '🇪🇹' }
};

export async function translateToAmharic(text) {
  return await directTranslateToLanguage(text, 'am');
}

export async function directTranslateToAmharic(text) {
  return await directTranslateToLanguage(text, 'am');
}

export async function directTranslateToLanguage(text, targetLang = 'am') {
  if (!text || !text.trim()) return '';
  const langConfig = SUPPORTED_LANGUAGES[targetLang] || SUPPORTED_LANGUAGES.am;
  const langName = langConfig.name;

  try {
    console.log(`Direct translating text to ${langName} (${targetLang})...`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `You are an accurate, direct translator. Translate the given text directly into natural ${langName}. CRITICAL RULES:\n1. Preserve the exact meaning, structure, paragraphs, and all factual details completely intact.\n2. Do NOT summarize, modify, rewrite, expand, or omit any content.\n3. Do NOT add bullet points, commentary, titles, or headers that do not exist in the source.\n4. Output ONLY the translated ${langName} text.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 2000,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      console.warn(`OpenRouter translation failed (${response.status}), falling back to Google Translate (${targetLang})`);
      return await translateWithGoogle(text, targetLang);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return await translateWithGoogle(text, targetLang);
    }

    const translatedText = data.choices[0].message.content.trim();
    const finalResult = translatedText || await translateWithGoogle(text, targetLang);
    return cleanEthiopicPunctuation(finalResult).trim();

  } catch (error) {
    console.error(`Error in directTranslateToLanguage (${targetLang}):`, error.message);
    const fallback = await translateWithGoogle(text, targetLang);
    return cleanEthiopicPunctuation(fallback).trim();
  }
}



/**
 * Top News Categories
 */
export const NEWS_CATEGORIES = [
  { id: 'tech', name: '💻 Tech & AI', description: 'AI, software, computing & gadgets' },
  { id: 'business', name: '📈 Business & Finance', description: 'Markets, economy, banking & commerce' },
  { id: 'world', name: '🌍 World News', description: 'Global headlines & international events' },
  { id: 'startups', name: '🚀 Startups & Africa', description: 'African tech, VC funding & innovation' },
  { id: 'science', name: '🔬 Science & Space', description: 'Science breakthroughs, health & space' },
  { id: 'education', name: '📚 Education', description: 'Learning, schools, universities & skills' },
  { id: 'research', name: '🔬 Research & Academia', description: 'Academic papers, studies & scientific research' },
  { id: 'crypto', name: '🪙 Crypto & Web3', description: 'Bitcoin, Ethereum, DeFi & blockchain' },
  { id: 'entertainment', name: '🎬 Entertainment', description: 'Movies, gaming, music & culture' },
  { id: 'sports', name: '⚽ Sports', description: 'Global football, athletics & tournaments' },
  { id: 'credits', name: '💰 Credits', description: 'AI credits, software credits & startup resources' },
  { id: 'geopolitics', name: '⚔️ War & Geopolitics', description: 'War, defense analysis & geopolitical intelligence' },
  { id: 'psychology', name: '🧠 Psychology & Science', description: 'Psychology, cognitive science & research studies' },
  { id: 'jokes', name: '😂 Jokes & Humor', description: 'Humor, jokes, satire & fun' },
  { id: 'economics', name: '📊 Economics & Stats', description: 'Country economic data, macro stats & indicators' },
  { id: 'intl_news', name: '📰 Intl News', description: 'Major international news providers & reporting' },
  { id: 'aggregators', name: '🌐 News Aggregators', description: 'News aggregators, feed readers & media monitoring' },
  { id: 'family', name: '👨‍👩‍👧 Relationships & Family', description: 'Relationships, parenting, family dynamics & social research' },
  { id: 'nature', name: '🌿 Nature & Wildlife', description: 'Nature, wildlife, biodiversity & conservation' },
  { id: 'curiosity', name: '✨ Amazing Facts & Curiosity', description: 'Fascinating discoveries, trivia, mysteries & general knowledge' },
  { id: 'wealth', name: '💎 Wealth & Billionaires', description: 'Billionaires, wealth intelligence, inequality & family offices' },
  { id: 'disaster', name: '🚨 Disaster & Emergencies', description: 'Disaster monitoring, humanitarian relief & emergency response' }
];

/**
 * News platforms configuration mapped by category
 * Only reputable, active sources with proven journalistic integrity
 */
export const NEWS_PLATFORMS = [
  // Tech & AI - Most Reputable Tech Sources
  { id: 'techcrunch', name: 'TechCrunch', category: 'tech', url: 'https://techcrunch.com/feed/' },
  { id: 'theverge', name: 'The Verge', category: 'tech', url: 'https://www.theverge.com/rss/index.xml' },
  { id: 'wired', name: 'WIRED', category: 'tech', url: 'https://www.wired.com/feed/rss' },
  { id: 'arstechnica', name: 'Ars Technica', category: 'tech', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { id: 'mittechreview', name: 'MIT Technology Review', category: 'tech', url: 'https://www.technologyreview.com/feed/' },
  { id: 'ieee', name: 'IEEE Spectrum', category: 'tech', url: 'https://spectrum.ieee.org/rss/full' },
  { id: 'venturebeat', name: 'VentureBeat', category: 'tech', url: 'https://venturebeat.com/feed/' },
  { id: 'engadget', name: 'Engadget', category: 'tech', url: 'https://www.engadget.com/rss.xml' },
  { id: 'newscientist', name: 'New Scientist', category: 'tech', url: 'https://www.newscientist.com/feed/' },

  // Business & Finance - Most Trusted Financial News
  { id: 'bloomberg', name: 'Bloomberg', category: 'business', url: 'https://www.bloomberg.com/feed' },
  { id: 'ft', name: 'Financial Times', category: 'business', url: 'https://www.ft.com/rss/world' },
  { id: 'economist', name: 'The Economist', category: 'business', url: 'https://www.economist.com/rss' },
  { id: 'reutersbiz', name: 'Reuters Business', category: 'business', url: 'https://www.reuters.com/rssFeed/businessNews' },
  { id: 'wsj', name: 'Wall Street Journal', category: 'business', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
  { id: 'cnbc', name: 'CNBC', category: 'business', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { id: 'forbes', name: 'Forbes', category: 'business', url: 'https://www.forbes.com/business/feed/' },
  { id: 'marketwatch', name: 'MarketWatch', category: 'business', url: 'https://www.marketwatch.com/rss/topstories' },
  { id: 'fastcompany', name: 'Fast Company', category: 'business', url: 'https://www.fastcompany.com/feed' },

  // World News - Most Trusted Global News Organizations
  { id: 'bbcworld', name: 'BBC World News', category: 'world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'reuters', name: 'Reuters World', category: 'world', url: 'https://www.reuters.com/rssFeed/worldNews' },
  { id: 'apnews', name: 'AP News', category: 'world', url: 'https://feeds.apnews.com/rss/apf-topnews' },
  { id: 'theguardian', name: 'The Guardian', category: 'world', url: 'https://www.theguardian.com/world/rss' },
  { id: 'aljazeera', name: 'Al Jazeera', category: 'world', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'dw', name: 'DW News', category: 'world', url: 'https://rss.dw.com/rdf/rss-en-all' },
  { id: 'npr', name: 'NPR World', category: 'world', url: 'https://feeds.npr.org/1004/rss.xml' },
  { id: 'nytimes', name: 'NY Times World', category: 'world', url: 'https://www.nytimes.com/services/xml/rss/nyt/World.xml' },

  // Startups & Africa - Focused on Innovation
  { id: 'techcabal', name: 'TechCabal', category: 'startups', url: 'https://techcabal.com/feed/' },
  { id: 'disruptafrica', name: 'Disrupt Africa', category: 'startups', url: 'https://disrupt-africa.com/feed/' },
  { id: 'restofworld', name: 'Rest of World', category: 'startups', url: 'https://restofworld.org/feed/latest/' },
  { id: 'techpointafrica', name: 'Techpoint Africa', category: 'startups', url: 'https://techpoint.africa/feed' },
  { id: 'weetracker', name: 'WeeTracker', category: 'startups', url: 'https://weetracker.com/feed' },
  { id: 'ventureburn', name: 'Ventureburn', category: 'startups', url: 'https://ventureburn.com/feed' },

  // Science & Space - Top Scientific Sources
  { id: 'sciencedaily', name: 'ScienceDaily', category: 'science', url: 'https://www.sciencedaily.com/rss/all.xml' },
  { id: 'physorg', name: 'Phys.org', category: 'science', url: 'https://phys.org/rss-feed/' },
  { id: 'spacecom', name: 'Space.com', category: 'science', url: 'https://www.space.com/feeds/all' },
  { id: 'nasa', name: 'NASA News', category: 'science', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss' },
  { id: 'sciam', name: 'Scientific American', category: 'science', url: 'https://www.scientificamerican.com/feed' },
  { id: 'naturebriefing', name: 'Nature Briefing', category: 'science', url: 'https://www.nature.com/nature/articles/rss' },
  { id: 'livescience', name: 'Live Science', category: 'science', url: 'https://www.livescience.com/feeds/all' },
  { id: 'natgeo', name: 'National Geographic', category: 'science', url: 'https://www.nationalgeographic.com/feed' },

  // Education - Leading Education Publications
  { id: 'educationweek', name: 'Education Week', category: 'education', url: 'https://www.edweek.org/feed' },
  { id: 'chronicle', name: 'The Chronicle', category: 'education', url: 'https://www.chronicle.com/rss' },
  { id: 'insidehighered', name: 'Inside Higher Ed', category: 'education', url: 'https://www.insidehighered.com/rss.xml' },
  { id: 'edsurge', name: 'EdSurge', category: 'education', url: 'https://www.edsurge.com/rss' },
  { id: 'timeshighered', name: 'Times Higher Education', category: 'education', url: 'https://www.timeshighereducation.com/rss/world-university-rankings' },

  // Research & Academia - Top Academic Journals
  { id: 'nature', name: 'Nature', category: 'research', url: 'https://www.nature.com/nature.rss' },
  { id: 'science', name: 'Science', category: 'research', url: 'https://www.science.org/rss/news_current.xml' },
  { id: 'pnas', name: 'PNAS', category: 'research', url: 'https://www.pnas.org/rss/pnas/current.xml' },
  { id: 'cell', name: 'Cell', category: 'research', url: 'https://www.cell.com/rss' },
  { id: 'arxiv', name: 'arXiv', category: 'research', url: 'https://export.arxiv.org/rss/cs.AI' },
  { id: 'eurekalert', name: 'EurekAlert!', category: 'research', url: 'https://www.eurekalert.org/rss.xml' },
  { id: 'plosone', name: 'PLOS ONE', category: 'research', url: 'https://www.plos.org/feed/plosone' },
  { id: 'theconversation', name: 'The Conversation', category: 'research', url: 'https://theconversation.com/technology/rss' },

  // Crypto & Web3 - Reputable Crypto News
  { id: 'coindesk', name: 'CoinDesk', category: 'crypto', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { id: 'cointelegraph', name: 'Cointelegraph', category: 'crypto', url: 'https://cointelegraph.com/rss' },
  { id: 'decrypt', name: 'Decrypt', category: 'crypto', url: 'https://decrypt.co/feed' },
  { id: 'blockworks', name: 'Blockworks', category: 'crypto', url: 'https://blockworks.co/feed' },
  { id: 'defiant', name: 'The Defiant', category: 'crypto', url: 'https://thedefiant.io/feed' },
  { id: 'bankless', name: 'Bankless', category: 'crypto', url: 'https://newsletter.banklesshq.com/feed' },

  // Entertainment - Top Entertainment News
  { id: 'variety', name: 'Variety', category: 'entertainment', url: 'https://variety.com/feed/' },
  { id: 'hollywoodreporter', name: 'Hollywood Reporter', category: 'entertainment', url: 'https://www.hollywoodreporter.com/feed/' },
  { id: 'rollingstone', name: 'Rolling Stone', category: 'entertainment', url: 'https://www.rollingstone.com/feed/' },
  { id: 'ign', name: 'IGN', category: 'entertainment', url: 'https://www.ign.com/feed/news' },
  { id: 'deadline', name: 'Deadline Hollywood', category: 'entertainment', url: 'https://deadline.com/feed' },
  { id: 'polygon', name: 'Polygon', category: 'entertainment', url: 'https://www.polygon.com/rss/index.xml' },
  { id: 'billboard', name: 'Billboard', category: 'entertainment', url: 'https://www.billboard.com/feed' },

  // Sports - Major Sports News
  { id: 'espn', name: 'ESPN', category: 'sports', url: 'https://www.espn.com/espn/rss/news' },
  { id: 'bbcsport', name: 'BBC Sport', category: 'sports', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { id: 'si', name: 'Sports Illustrated', category: 'sports', url: 'https://www.si.com/rss' },
  { id: 'theathletic', name: 'The Athletic', category: 'sports', url: 'https://theathletic.com/feed' },
  { id: 'bleacherreport', name: 'Bleacher Report', category: 'sports', url: 'https://bleacherreport.com/feed' },
  { id: 'skysports', name: 'Sky Sports', category: 'sports', url: 'https://www.skysports.com/rss/0,20514,00.xml' },
  { id: 'goalcom', name: 'Goal.com', category: 'sports', url: 'https://www.goal.com/en/feeds/news' },

  // Credits - AI/Software Credits & Startup Resources
  { id: 'aicredits_dev', name: 'AICredits.dev', category: 'credits', url: 'https://aicredits.dev/' },
  { id: 'findaicredits', name: 'Find AI Credits', category: 'credits', url: 'https://www.findaicredits.com/' },
  { id: 'aicreditsandstartups', name: 'AI Credits & Startups', category: 'credits', url: 'https://aicreditsandstartups.com' },
  { id: 'freecredit_ai', name: 'FreeCredit.ai', category: 'credits', url: 'https://freecredit.ai' },

  // War & Geopolitical Intelligence
  { id: 'isw', name: 'Institute for the Study of War', category: 'geopolitics', url: 'https://www.understandingwar.org/' },
  { id: 'acled', name: 'ACLED Data', category: 'geopolitics', url: 'https://acleddata.com/' },
  { id: 'crisisgroup', name: 'Crisis Group', category: 'geopolitics', url: 'https://www.crisisgroup.org/' },
  { id: 'sipri', name: 'SIPRI', category: 'geopolitics', url: 'https://www.sipri.org/' },
  { id: 'iiss', name: 'IISS', category: 'geopolitics', url: 'https://www.iiss.org/' },
  { id: 'csis', name: 'CSIS', category: 'geopolitics', url: 'https://www.csis.org/' },

  // Psychology & Scientific Research
  { id: 'scholar_google', name: 'Google Scholar', category: 'psychology', url: 'https://scholar.google.com/' },
  { id: 'pubmed', name: 'PubMed', category: 'psychology', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
  { id: 'apa', name: 'American Psychological Association', category: 'psychology', url: 'https://www.apa.org/' },
  { id: 'frontiers_psych', name: 'Frontiers in Psychology', category: 'psychology', url: 'https://www.frontiersin.org/journals/psychology' },
  { id: 'nature_psych', name: 'Nature Psychology', category: 'psychology', url: 'https://www.nature.com/subjects/psychology' },

  // Jokes & Humor
  { id: 'reddit_jokes', name: 'Reddit r/Jokes', category: 'jokes', url: 'https://www.reddit.com/r/Jokes/' },
  { id: 'reddit_dadjokes', name: 'Reddit r/dadjokes', category: 'jokes', url: 'https://www.reddit.com/r/dadjokes/' },
  { id: 'ninegag', name: '9GAG', category: 'jokes', url: 'https://www.9gag.com/' },
  { id: 'theonion', name: 'The Onion', category: 'jokes', url: 'https://www.theonion.com/' },
  { id: 'icanhazdadjoke', name: 'icanhazdadjoke', category: 'jokes', url: 'https://icanhazdadjoke.com/' },

  // Country Economics & Statistics
  { id: 'worldbank_data', name: 'World Bank Data', category: 'economics', url: 'https://data.worldbank.org/' },
  { id: 'imf_data', name: 'IMF Data', category: 'economics', url: 'https://www.imf.org/en/Data' },
  { id: 'trading_econ', name: 'Trading Economics', category: 'economics', url: 'https://tradingeconomics.com/' },
  { id: 'oecd_data', name: 'OECD Data', category: 'economics', url: 'https://data.oecd.org/' },
  { id: 'ourworldindata', name: 'Our World in Data', category: 'economics', url: 'https://ourworldindata.org/' },
  { id: 'worldometers', name: 'Worldometers', category: 'economics', url: 'https://www.worldometers.info/' },

  // International News Providers
  { id: 'reuters_intl', name: 'Reuters', category: 'intl_news', url: 'https://www.reuters.com/' },
  { id: 'apnews_intl', name: 'AP News', category: 'intl_news', url: 'https://apnews.com/' },
  { id: 'bbc_intl', name: 'BBC News', category: 'intl_news', url: 'https://www.bbc.com/news' },
  { id: 'aljazeera_intl', name: 'Al Jazeera', category: 'intl_news', url: 'https://www.aljazeera.com/' },
  { id: 'dw_intl', name: 'DW News', category: 'intl_news', url: 'https://www.dw.com/' },
  { id: 'france24_intl', name: 'France 24', category: 'intl_news', url: 'https://www.france24.com/' },
  { id: 'theguardian_intl', name: 'The Guardian', category: 'intl_news', url: 'https://www.theguardian.com/international' },
  { id: 'bloomberg_intl', name: 'Bloomberg', category: 'intl_news', url: 'https://www.bloomberg.com/' },

  // News Aggregators & Media Monitoring
  { id: 'google_news', name: 'Google News', category: 'aggregators', url: 'https://news.google.com/' },
  { id: 'ground_news', name: 'Ground News', category: 'aggregators', url: 'https://ground.news/' },
  { id: 'allsides', name: 'AllSides', category: 'aggregators', url: 'https://www.allsides.com/' },
  { id: 'feedly', name: 'Feedly', category: 'aggregators', url: 'https://feedly.com/' },
  { id: 'inoreader', name: 'Inoreader', category: 'aggregators', url: 'https://www.inoreader.com/' },
  { id: 'gdelt', name: 'GDELT Project', category: 'aggregators', url: 'https://www.gdeltproject.org/' },
  { id: 'newsapi', name: 'NewsAPI', category: 'aggregators', url: 'https://newsapi.org/' },

  // Relationships & Family Intelligence
  { id: 'psych_today', name: 'Psychology Today', category: 'family', url: 'https://www.psychologytoday.com/' },
  { id: 'gottman_blog', name: 'Gottman Institute', category: 'family', url: 'https://www.gottman.com/blog/' },
  { id: 'verywell_mind', name: 'Verywell Mind', category: 'family', url: 'https://www.verywellmind.com/' },
  { id: 'mindbodygreen_rel', name: 'MindBodyGreen Relationships', category: 'family', url: 'https://www.mindbodygreen.com/relationships' },
  { id: 'vice_rel', name: 'Vice Relationships', category: 'family', url: 'https://www.vice.com/en/section/relationships' },
  { id: 'refinery29_rel', name: 'Refinery29 Relationships', category: 'family', url: 'https://www.refinery29.com/en-us/relationships' },
  { id: 'parents_mag', name: 'Parents', category: 'family', url: 'https://www.parents.com/' },
  { id: 'verywell_family', name: 'Verywell Family', category: 'family', url: 'https://www.verywellfamily.com/' },
  { id: 'today_parents', name: 'Today Parents', category: 'family', url: 'https://www.today.com/parents' },
  { id: 'romper', name: 'Romper', category: 'family', url: 'https://www.romper.com/' },
  { id: 'fatherly', name: 'Fatherly', category: 'family', url: 'https://www.fatherly.com/' },
  { id: 'motherly', name: 'Motherly', category: 'family', url: 'https://www.mother.ly/' },
  { id: 'scary_mommy', name: 'Scary Mommy', category: 'family', url: 'https://www.scarymommy.com/' },
  { id: 'ifstudies', name: 'Institute for Family Studies', category: 'family', url: 'https://ifstudies.org/' },
  { id: 'marriage_com', name: 'Marriage.com', category: 'family', url: 'https://www.marriage.com/' },
  { id: 'ncfr', name: 'National Council on Family Relations', category: 'family', url: 'https://www.ncfr.org/' },
  { id: 'aamft', name: 'AAMFT', category: 'family', url: 'https://www.aamft.org/' },
  { id: 'the_cut_rel', name: 'The Cut Sex & Relationships', category: 'family', url: 'https://www.thecut.com/sex-and-relationships/' },
  { id: 'bustle_rel', name: 'Bustle Sex & Relationships', category: 'family', url: 'https://www.bustle.com/sex-relationships' },
  { id: 'glamour_rel', name: 'Glamour Relationships', category: 'family', url: 'https://www.glamour.com/love-sex-relationships' },
  { id: 'guardian_rel', name: 'The Guardian Relationships', category: 'family', url: 'https://www.theguardian.com/lifeandstyle/relationships' },
  { id: 'bbc_worklife', name: 'BBC Worklife', category: 'family', url: 'https://www.bbc.com/worklife' },
  { id: 'unfpa', name: 'UNFPA', category: 'family', url: 'https://www.unfpa.org/' },
  { id: 'un_population', name: 'UN Population Division', category: 'family', url: 'https://population.un.org/' },
  { id: 'pew_family', name: 'Pew Research Family & Relationships', category: 'family', url: 'https://www.pewresearch.org/topic/family-relationships/' },
  { id: 'oecd_family', name: 'OECD Family', category: 'family', url: 'https://www.oecd.org/social/family/' },
  { id: 'ourworld_family', name: 'Our World in Data Family', category: 'family', url: 'https://ourworldindata.org/family' },

  // Nature & Wildlife Intelligence (Global, Research & African)
  { id: 'natgeo_wild', name: 'National Geographic', category: 'nature', url: 'https://www.nationalgeographic.com/' },
  { id: 'bbc_earth', name: 'BBC Earth', category: 'nature', url: 'https://www.bbcearth.com/' },
  { id: 'mongabay', name: 'Mongabay', category: 'nature', url: 'https://www.mongabay.com/' },
  { id: 'conservation_frontlines', name: 'Conservation Frontlines', category: 'nature', url: 'https://www.conservationfrontlines.org/' },
  { id: 'earth_org', name: 'Earth.org', category: 'nature', url: 'https://www.earth.org/' },
  { id: 'sciencedaily_nature', name: 'ScienceDaily Nature', category: 'nature', url: 'https://www.sciencedaily.com/' },
  { id: 'livescience_nature', name: 'Live Science Nature', category: 'nature', url: 'https://www.livescience.com/' },
  { id: 'sciencenews_nature', name: 'Science News', category: 'nature', url: 'https://www.sciencenews.org/' },
  { id: 'smithsonian_nature', name: 'Smithsonian Science & Nature', category: 'nature', url: 'https://www.smithsonianmag.com/science-nature/' },
  { id: 'sciam_nature', name: 'Scientific American Nature', category: 'nature', url: 'https://www.scientificamerican.com/' },
  { id: 'nature_journal', name: 'Nature.com', category: 'nature', url: 'https://www.nature.com/' },
  { id: 'science_journal', name: 'Science.org', category: 'nature', url: 'https://www.science.org/' },
  { id: 'phys_org_nature', name: 'Phys.org Nature', category: 'nature', url: 'https://phys.org/' },
  { id: 'eurekalert_nature', name: 'EurekAlert Nature', category: 'nature', url: 'https://www.eurekalert.org/' },
  { id: 'sci_news', name: 'Sci.News', category: 'nature', url: 'https://www.sci.news/' },
  { id: 'guardian_env', name: 'The Guardian Environment', category: 'nature', url: 'https://www.theguardian.com/environment' },
  { id: 'ecowatch', name: 'EcoWatch', category: 'nature', url: 'https://www.ecowatch.com/' },
  { id: 'grist', name: 'Grist', category: 'nature', url: 'https://grist.org/' },
  { id: 'yale_e360', name: 'Yale E360', category: 'nature', url: 'https://e360.yale.edu/' },
  { id: 'enn', name: 'Environmental News Network', category: 'nature', url: 'https://www.enn.com/' },
  { id: 'wildlife_society', name: 'The Wildlife Society', category: 'nature', url: 'https://wildlife.org/' },
  { id: 'audubon', name: 'Audubon', category: 'nature', url: 'https://www.audubon.org/' },
  { id: 'birdlife', name: 'BirdLife International', category: 'nature', url: 'https://www.birdlife.org/' },
  { id: 'iucn', name: 'IUCN', category: 'nature', url: 'https://www.iucn.org/' },
  { id: 'wwf', name: 'World Wildlife Fund', category: 'nature', url: 'https://www.worldwildlife.org/' },
  { id: 'nature_conservancy', name: 'The Nature Conservancy', category: 'nature', url: 'https://www.nature.org/' },
  { id: 'oceanographic_mag', name: 'Oceanographic Magazine', category: 'nature', url: 'https://www.oceanographicmagazine.com/' },
  { id: 'hakai_mag', name: 'Hakai Magazine', category: 'nature', url: 'https://hakaimagazine.com/' },
  { id: 'animal_reader', name: 'The Animal Reader', category: 'nature', url: 'https://www.theanimalreader.com/' },
  { id: 'rewilding', name: 'Rewilding Institute', category: 'nature', url: 'https://www.rewilding.org/' },
  { id: 'animal_diversity', name: 'Animal Diversity Web', category: 'nature', url: 'https://animaldiversity.org/' },
  { id: 'inaturalist', name: 'iNaturalist', category: 'nature', url: 'https://www.inaturalist.org/' },
  { id: 'gbif', name: 'GBIF', category: 'nature', url: 'https://www.gbif.org/' },
  { id: 'biodiversity_lib', name: 'Biodiversity Heritage Library', category: 'nature', url: 'https://www.biodiversitylibrary.org/' },
  { id: 'xeno_canto', name: 'xeno-canto', category: 'nature', url: 'https://www.xeno-canto.org/' },
  { id: 'marinebio', name: 'MarineBio', category: 'nature', url: 'https://www.marinebio.org/' },
  { id: 'fishbase', name: 'FishBase', category: 'nature', url: 'https://www.fishbase.se/' },
  { id: 'iucn_redlist', name: 'IUCN Red List', category: 'nature', url: 'https://www.iucnredlist.org/' },
  { id: 'world_animal_prot', name: 'World Animal Protection', category: 'nature', url: 'https://www.worldanimalprotection.org/' },
  { id: 'africa_geo', name: 'Africa Geographic', category: 'nature', url: 'https://africageographic.com/' },
  { id: 'awf', name: 'African Wildlife Foundation', category: 'nature', url: 'https://www.awf.org/' },
  { id: 'african_parks', name: 'African Parks', category: 'nature', url: 'https://www.africanparks.org/' },
  { id: 'african_conserv', name: 'African Conservation Foundation', category: 'nature', url: 'https://www.africanconservation.org/' },
  { id: 'save_rhino', name: 'Save the Rhino', category: 'nature', url: 'https://www.savetherhino.org/' },
  { id: 'elephant_voices', name: 'ElephantVoices', category: 'nature', url: 'https://www.elephantvoices.org/' },
  { id: 'birdlife_africa', name: 'BirdLife Africa', category: 'nature', url: 'https://www.birdlife.org/africa/' },

  // Amazing Facts & Curiosity Intelligence
  { id: 'atlas_obscura', name: 'Atlas Obscura', category: 'curiosity', url: 'https://www.atlasobscura.com/' },
  { id: 'sciencealert', name: 'ScienceAlert', category: 'curiosity', url: 'https://www.sciencealert.com/' },
  { id: 'iflscience', name: 'IFLScience', category: 'curiosity', url: 'https://www.iflscience.com/' },
  { id: 'discover_mag', name: 'Discover Magazine', category: 'curiosity', url: 'https://www.discovermagazine.com/' },
  { id: 'mental_floss', name: 'Mental Floss', category: 'curiosity', url: 'https://www.mentalfloss.com/' },
  { id: 'popsci', name: 'Popular Science', category: 'curiosity', url: 'https://www.popsci.com/' },
  { id: 'howstuffworks', name: 'HowStuffWorks', category: 'curiosity', url: 'https://www.howstuffworks.com/' },
  { id: 'todayifoundout', name: 'Today I Found Out', category: 'curiosity', url: 'https://www.todayifoundout.com/' },
  { id: 'factretriever', name: 'Fact Retriever', category: 'curiosity', url: 'https://www.factretriever.com/' },
  { id: 'worldatlas', name: 'WorldAtlas', category: 'curiosity', url: 'https://www.worldatlas.com/' },
  { id: 'amusing_planet', name: 'Amusing Planet', category: 'curiosity', url: 'https://www.amusingplanet.com/' },
  { id: 'oddity_central', name: 'Oddity Central', category: 'curiosity', url: 'https://www.odditycentral.com/' },
  { id: 'open_culture', name: 'Open Culture', category: 'curiosity', url: 'https://www.openculture.com/' },
  { id: 'ancient_origins', name: 'Ancient Origins', category: 'curiosity', url: 'https://www.ancient-origins.net/' },
  { id: 'skeptical_science', name: 'Skeptical Science', category: 'curiosity', url: 'https://www.skepticalscience.com/' },
  { id: 'snopes', name: 'Snopes', category: 'curiosity', url: 'https://www.snopes.com/' },
  { id: 'reuters_factcheck', name: 'Reuters Fact Check', category: 'curiosity', url: 'https://www.reuters.com/fact-check/' },
  { id: 'bbc_future', name: 'BBC Future', category: 'curiosity', url: 'https://www.bbc.com/future' },

  // Wealth & Billionaires
  { id: 'forbes_billionaires', name: 'Forbes Billionaires', category: 'wealth', url: 'https://www.forbes.com/billionaires/' },
  { id: 'bloomberg_billionaires', name: 'Bloomberg Billionaires', category: 'wealth', url: 'https://www.bloomberg.com/billionaires/' },
  { id: 'forbes_realtime', name: 'Forbes Real-Time Billionaires', category: 'wealth', url: 'https://www.forbes.com/real-time-billionaires/' },
  { id: 'bi_billionaires', name: 'Business Insider Billionaires', category: 'wealth', url: 'https://www.businessinsider.com/billionaires' },
  { id: 'cnbc_wealth', name: 'CNBC Wealth', category: 'wealth', url: 'https://www.cnbc.com/wealth/' },
  { id: 'ft_wealth', name: 'Financial Times Wealth', category: 'wealth', url: 'https://www.ft.com/wealth' },
  { id: 'wsj_business', name: 'Wall Street Journal Business', category: 'wealth', url: 'https://www.wsj.com/news/business' },
  { id: 'economist_wealth', name: 'The Economist', category: 'wealth', url: 'https://www.economist.com/' },
  { id: 'bloomberg_wealth', name: 'Bloomberg Wealth', category: 'wealth', url: 'https://www.bloomberg.com/wealth' },
  { id: 'wealthx', name: 'Wealth-X', category: 'wealth', url: 'https://www.wealthx.com/' },
  { id: 'altrata', name: 'Altrata', category: 'wealth', url: 'https://www.altrata.com/' },
  { id: 'hurun_report', name: 'Hurun Report', category: 'wealth', url: 'https://www.hurun.net/' },
  { id: 'oxfam_inequality', name: 'Oxfam Inequality', category: 'wealth', url: 'https://www.oxfam.org/en/what-we-do/issues/extreme-inequality' },
  { id: 'inequality_org', name: 'Inequality.org', category: 'wealth', url: 'https://inequality.org/' },
  { id: 'propublica_irs', name: 'ProPublica Secret IRS Files', category: 'wealth', url: 'https://www.propublica.org/series/the-secret-irs-files' },
  { id: 'visual_capitalist', name: 'Visual Capitalist', category: 'wealth', url: 'https://www.visualcapitalist.com/' },
  { id: 'statista', name: 'Statista', category: 'wealth', url: 'https://www.statista.com/' },
  { id: 'pbs_frontline', name: 'PBS Frontline', category: 'wealth', url: 'https://www.pbs.org/show/frontline/' },
  { id: 'forbes_sites', name: 'Forbes Contributors', category: 'wealth', url: 'https://www.forbes.com/sites/' },
  { id: 'campden_fb', name: 'Campden FB', category: 'wealth', url: 'https://www.campdenfb.com/' },
  { id: 'family_biz_mag', name: 'Family Business Magazine', category: 'wealth', url: 'https://www.familybusinessmagazine.com/' },

  // Disaster & Emergencies
  { id: 'reliefweb', name: 'ReliefWeb', category: 'disaster', url: 'https://reliefweb.int/' },
  { id: 'emdat', name: 'EM-DAT Disaster Database', category: 'disaster', url: 'https://www.emdat.be/' },
  { id: 'gdacs', name: 'GDACS', category: 'disaster', url: 'https://www.gdacs.org/' },
  { id: 'preventionweb', name: 'PreventionWeb', category: 'disaster', url: 'https://www.preventionweb.net/' },
  { id: 'undrr', name: 'UNDRR', category: 'disaster', url: 'https://www.undrr.org/' },
  { id: 'unocha', name: 'UN OCHA', category: 'disaster', url: 'https://www.unocha.org/' },
  { id: 'ifrc', name: 'IFRC', category: 'disaster', url: 'https://www.ifrc.org/' },
  { id: 'unhcr', name: 'UNHCR', category: 'disaster', url: 'https://www.unhcr.org/' },
  { id: 'iom', name: 'IOM UN Migration', category: 'disaster', url: 'https://www.iom.int/' },
  { id: 'who_emergencies', name: 'WHO Emergencies', category: 'disaster', url: 'https://www.who.int/emergencies' },
  { id: 'unicef_emergencies', name: 'UNICEF Emergencies', category: 'disaster', url: 'https://www.unicef.org/emergencies' },
  { id: 'reuters_world', name: 'Reuters World Emergencies', category: 'disaster', url: 'https://www.reuters.com/world/' },
  { id: 'usgs_earthquake', name: 'USGS Earthquakes', category: 'disaster', url: 'https://earthquake.usgs.gov/' },
  { id: 'nhc_noaa', name: 'National Hurricane Center', category: 'disaster', url: 'https://www.nhc.noaa.gov/' },
  { id: 'noaa_gov', name: 'NOAA', category: 'disaster', url: 'https://www.noaa.gov/' },
  { id: 'nasa_firms', name: 'NASA FIRMS Fire Maps', category: 'disaster', url: 'https://firms.modaps.eosdis.nasa.gov/' },
  { id: 'disaster_charter', name: 'International Disaster Charter', category: 'disaster', url: 'https://disastercharter.org/' },
  { id: 'sentinel_hub', name: 'Sentinel Hub', category: 'disaster', url: 'https://www.sentinel-hub.com/' },
  { id: 'worldbank_drm', name: 'World Bank Disaster Risk Management', category: 'disaster', url: 'https://www.worldbank.org/en/topic/disasterriskmanagement' },
  { id: 'internal_displacement', name: 'Internal Displacement Monitoring Centre', category: 'disaster', url: 'https://www.internal-displacement.org/' },
  { id: 'ilo_safety', name: 'ILO Safety & Health at Work', category: 'disaster', url: 'https://www.ilo.org/topics/safety-and-health-work' }
];

/**
 * Simple RSS/Atom feed parser (no external libraries)
 */
function parseRSS(xmlString) {
  const items = [];
  
  try {
    // Check if it's Atom format (The Verge uses this)
    const isAtom = xmlString.includes('<entry>');
    
    if (isAtom) {
      // Parse Atom format
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
      let match;
      
      while ((match = entryRegex.exec(xmlString)) !== null) {
        const entryContent = match[1];
        
        // Extract title (handle CDATA and HTML)
        const titleMatch = entryContent.match(/<title[^>]*><!\[CDATA\[([^\]]*)\]\]><\/title>/i) ||
                           entryContent.match(/<title[^>]*>([^<]*)<\/title>/i) ||
                           entryContent.match(/<title[^>]*type="html"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i);
        let title = titleMatch ? titleMatch[1].trim() : '';
        
        // Decode HTML entities in title
        if (title) {
          title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#8217;/g, "'").replace(/&#8230;/g, '...');
        }
        
        // Extract link (Atom uses different format)
        const linkMatch = entryContent.match(/<link[^>]*href="([^"]*)"[^>]*>/i);
        const link = linkMatch ? linkMatch[1].trim() : '';
        
        // Extract content (Atom uses <content> instead of <description>)
        const contentMatch = entryContent.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
        const content = contentMatch ? contentMatch[1].trim() : '';
        
        // Extract image from various sources
        let image = '';

        // Try media:content with url attribute
        const mediaContentMatch = entryContent.match(/<media:content[^>]*url="([^"]*)"[^>]*>/i);
        if (mediaContentMatch) {
          image = mediaContentMatch[1].trim();
        }

        // Try media:thumbnail
        if (!image) {
          const thumbMatch = entryContent.match(/<media:thumbnail[^>]*url="([^"]*)"[^>]*>/i);
          image = thumbMatch ? thumbMatch[1].trim() : '';
        }

        // Try to extract image from content HTML (look for img tags with src)
        if (!image && content) {
          const imgMatch = content.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|gif|webp|avif)(?:\?[^"']*)?)["']/i) ||
                           content.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (imgMatch && !imgMatch[1].includes('feedburner') && !imgMatch[1].includes('doubleclick')) {
            image = imgMatch[1].trim();
          }
        }

        // Decode HTML entities in image URL
        if (image) {
          image = image.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        }

        // Extract video from enclosure or media:content
        let video = '';

        // Try enclosure with video mime type
        const enclosureMatch = entryContent.match(/<enclosure[^>]*url="([^"]*)"[^>]*type="video\/[^"]*"[^>]*>/i);
        if (enclosureMatch) {
          video = enclosureMatch[1].trim();
        }

        // Try media:content with video type
        if (!video) {
          const mediaVideoMatch = entryContent.match(/<media:content[^>]*url="([^"]*)"[^>]*type="video\/[^"]*"[^>]*>/i);
          if (mediaVideoMatch) {
            video = mediaVideoMatch[1].trim();
          }
        }

        // Try enclosure with common video extensions
        if (!video) {
          const enclosureExtMatch = entryContent.match(/<enclosure[^>]*url="([^"]*\.(?:mp4|webm|mov|avi|mkv))"[^>]*>/i);
          if (enclosureExtMatch) {
            video = enclosureExtMatch[1].trim();
          }
        }

        // Decode HTML entities in video URL
        if (video) {
          video = video.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        }

        // Extract published date
        const dateMatch = entryContent.match(/<published>([^<]*)<\/published>/i) ||
                          entryContent.match(/<updated>([^<]*)<\/updated>/i);
        const pubDate = dateMatch ? dateMatch[1].trim() : '';
        
        if (title && link) {
          items.push({
            title,
            link,
            image,
            video,
            description: content,
            time: pubDate || 'Recently'
          });
        }
      }
    } else {
      // Parse RSS 2.0 format
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;
      
      while ((match = itemRegex.exec(xmlString)) !== null) {
        const itemContent = match[1];
        
        // Extract title (handle CDATA)
        const titleMatch = itemContent.match(/<title><!\[CDATA\[([^\]]*)\]\]><\/title>/i) ||
                           itemContent.match(/<title>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        // Extract link
        const linkMatch = itemContent.match(/<link>([^<]*)<\/link>/i);
        const link = linkMatch ? linkMatch[1].trim() : '';
        
        // Extract description (handle CDATA)
        const descMatch = itemContent.match(/<description><!\[CDATA\[([^\]]*)\]\]><\/description>/i) ||
                          itemContent.match(/<description>([^<]*)<\/description>/i);
        const description = descMatch ? descMatch[1].trim() : '';
        
        // Extract image from various media tags
        let image = '';

        // Try media:content with url attribute
        const mediaContentMatch = itemContent.match(/<media:content[^>]*url="([^"]*)"[^>]*>/i);
        if (mediaContentMatch) {
          image = mediaContentMatch[1].trim();
        }

        // Try enclosure with image type or image extension
        if (!image) {
          const enclosureMatch = itemContent.match(/<enclosure[^>]*url="([^"]*)"[^>]*type="image\/[^"]*"[^>]*>/i) ||
                                 itemContent.match(/<enclosure[^>]*type="image\/[^"]*"[^>]*url="([^"]*)"[^>]*>/i) ||
                                 itemContent.match(/<enclosure[^>]*url="([^"]*\.(?:jpg|jpeg|png|gif|webp|avif)(?:\?[^"]*)?)"[^>]*>/i);
          image = enclosureMatch ? (enclosureMatch[1] || enclosureMatch[2] || '').trim() : '';
        }

        // Try media:thumbnail
        if (!image) {
          const thumbMatch = itemContent.match(/<media:thumbnail[^>]*url="([^"]*)"[^>]*>/i);
          image = thumbMatch ? thumbMatch[1].trim() : '';
        }

        // Try to extract from content:encoded first (often has full resolution images)
        if (!image) {
          const contentMatch = itemContent.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i);
          if (contentMatch) {
            const contentImgMatch = contentMatch[1].match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|gif|webp|avif)(?:\?[^"']*)?)["']/i) ||
                                    contentMatch[1].match(/<img[^>]+src=["']([^"']+)["']/i);
            if (contentImgMatch && !contentImgMatch[1].includes('feedburner') && !contentImgMatch[1].includes('doubleclick')) {
              image = contentImgMatch[1].trim();
            }
          }
        }

        // Try to extract image from description HTML
        if (!image && description) {
          const imgMatch = description.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|gif|webp|avif)(?:\?[^"']*)?)["']/i) ||
                           description.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (imgMatch && !imgMatch[1].includes('feedburner') && !imgMatch[1].includes('doubleclick')) {
            image = imgMatch[1].trim();
          }
        }

        // Decode HTML entities in image URL
        if (image) {
          image = image.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        }

        // Extract video from enclosure or media:content
        let video = '';

        // Try enclosure with video mime type
        const enclosureVideoMatch = itemContent.match(/<enclosure[^>]*url="([^"]*)"[^>]*type="video\/[^"]*"[^>]*>/i);
        if (enclosureVideoMatch) {
          video = enclosureVideoMatch[1].trim();
        }

        // Try media:content with video type
        if (!video) {
          const mediaVideoMatch = itemContent.match(/<media:content[^>]*url="([^"]*)"[^>]*type="video\/[^"]*"[^>]*>/i);
          if (mediaVideoMatch) {
            video = mediaVideoMatch[1].trim();
          }
        }

        // Try enclosure with common video extensions
        if (!video) {
          const enclosureExtMatch = itemContent.match(/<enclosure[^>]*url="([^"]*\.(?:mp4|webm|mov|avi|mkv))"[^>]*>/i);
          if (enclosureExtMatch) {
            video = enclosureExtMatch[1].trim();
          }
        }

        // Decode HTML entities in video URL
        if (video) {
          video = video.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        }

        // Extract pubDate
        const dateMatch = itemContent.match(/<pubDate>([^<]*)<\/pubDate>/i);
        const pubDate = dateMatch ? dateMatch[1].trim() : '';
        
        if (title && link) {
          items.push({
            title,
            link,
            image,
            video,
            description,
            time: pubDate || 'Recently'
          });
        }
      }
    }
  } catch (error) {
    console.error('Error parsing RSS:', error.message);
  }
  
  return items;
}

/**
 * Helper to fetch og:image or twitter:image from article URL when RSS lacks an image
 */
export async function fetchArticleImage(link) {
  if (!link || !link.startsWith('http')) return '';
  try {
    const res = await fetch(link, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!res.ok) return '';
    const html = await res.text();
    const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                  html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i) ||
                  html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                  html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i);
    if (match && match[1]) {
      return match[1].replace(/&amp;/g, '&').trim();
    }
    return '';
  } catch (err) {
    console.error('Error fetching article og:image:', err.message);
    return '';
  }
}

/**
 * Fetch news from a single RSS feed or website link with auto-discovery
 */
export async function fetchRSSFeed(url, platformName) {
  try {
    let feedUrl = url.trim();

    // Specialized handler for AICredits.dev
    if (feedUrl.includes('aicredits.dev')) {
      const res = await fetch('https://aicredits.dev/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!res.ok) return [];
      const html = await res.text();
      const linkRegex = /<a[^>]+href=["'](\/submissions\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      const items = [];
      const seen = new Set();
      while ((m = linkRegex.exec(html)) !== null) {
        const href = m[1];
        if (seen.has(href)) continue;
        seen.add(href);
        const content = m[2];
        const titleMatch = content.match(/<p[^>]+text-neutral-100[^>]*>([^<]+)<\/p>/i) ||
                           content.match(/<h\d[^>]*>([^<]+)<\/h\d>/i);
        const descMatch = content.match(/<p[^>]+text-neutral-400[^>]*>([^<]+)<\/p>/i);
        const rawClean = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const title = titleMatch ? titleMatch[1].trim() : rawClean;
        const desc = descMatch ? descMatch[1].trim() : title;
        if (title && title.length > 3) {
          items.push({
            title,
            link: 'https://aicredits.dev' + href,
            description: desc,
            image: 'https://aicredits.dev/og-image.png',
            time: 'Recently',
            platform: platformName
          });
        }
      }
      if (items.length < 15) {
        try {
          const subRes = await fetch('https://aicredits.dev/submissions', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (subRes.ok) {
            const subHtml = await subRes.text();
            const subRegex = /<a[^>]+href=["'](\/submissions\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
            let sm;
            while ((sm = subRegex.exec(subHtml)) !== null) {
              const href = sm[1];
              if (seen.has(href)) continue;
              seen.add(href);
              const content = sm[2];
              const rawClean = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              if (rawClean && rawClean.length > 5) {
                items.push({
                  title: rawClean,
                  link: 'https://aicredits.dev' + href,
                  description: 'AI credits & startup program: ' + rawClean,
                  image: 'https://aicredits.dev/og-image.png',
                  time: 'Recently',
                  platform: platformName
                });
              }
              if (items.length >= 15) break;
            }
          }
        } catch (_) {}
      }
      return items;
    }

    // Specialized handler for Find AI Credits
    if (feedUrl.includes('findaicredits.com')) {
      const res = await fetch('https://www.findaicredits.com/sitemap.xml', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!res.ok) return [];
      const text = await res.text();
      const deals = (text.match(/<loc>[^<]+<\/loc>/g) || [])
        .map(m => m.replace(/<\/?loc>/g, '').trim())
        .filter(u => u.includes('/deals/'));
      const blogs = (text.match(/<loc>[^<]+<\/loc>/g) || [])
        .map(m => m.replace(/<\/?loc>/g, '').trim())
        .filter(u => u.includes('/blog/'));
      const allUrls = [...deals, ...blogs];
      return allUrls.slice(0, 15).map(u => {
        const slug = u.split('/').pop();
        const rawTitle = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return {
          title: rawTitle,
          link: u,
          description: 'Free AI credits & startup deal: ' + rawTitle,
          image: 'https://findaicredits.com/images/findaicredits.png',
          time: 'Recently',
          platform: platformName
        };
      });
    }

    let response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${platformName}: ${response.status}`);
      return [];
    }

    let text = await response.text();
    let items = parseRSS(text);

    // If no RSS items found, the URL might be a regular webpage (like https://theonion.com or https://shega.co/news)
    if (items.length === 0) {
      // 1. Try to discover RSS/Atom <link> tag from HTML
      const feedLinkMatch = text.match(/<link[^>]+(?:type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']|href=["']([^"']+)["'][^>]+type=["']application\/(?:rss|atom)\+xml["'])/i);
      const discoveredUrl = feedLinkMatch ? (feedLinkMatch[1] || feedLinkMatch[2]) : null;

      if (discoveredUrl) {
        let resolvedFeedUrl = discoveredUrl;
        if (resolvedFeedUrl.startsWith('/')) {
          const originMatch = feedUrl.match(/^(https?:\/\/[^\/]+)/i);
          const origin = originMatch ? originMatch[1] : '';
          resolvedFeedUrl = origin + resolvedFeedUrl;
        }
        console.log(`Discovered RSS feed for ${platformName}: ${resolvedFeedUrl}`);
        try {
          const feedRes = await fetch(resolvedFeedUrl);
          if (feedRes.ok) {
            const feedText = await feedRes.text();
            items = parseRSS(feedText);
          }
        } catch (_) {}
      }

      // 2. If still empty, try common feed suffixes (feed, rss, rss.xml, atom.xml)
      if (items.length === 0 && !feedUrl.endsWith('/feed') && !feedUrl.endsWith('/rss')) {
        const cleanBase = feedUrl.replace(/\/+$/, '');
        const candidateUrls = [`${cleanBase}/feed/`, `${cleanBase}/feed`, `${cleanBase}/rss`, `${cleanBase}/rss.xml`];
        for (const candidate of candidateUrls) {
          try {
            const candRes = await fetch(candidate);
            if (candRes.ok) {
              const candText = await candRes.text();
              const candItems = parseRSS(candText);
              if (candItems.length > 0) {
                items = candItems;
                console.log(`Found feed for ${platformName} via candidate: ${candidate}`);
                break;
              }
            }
          } catch (_) {}
        }
      }

      // 3. If still empty, scrape news article headlines & links directly from the webpage HTML
      if (items.length === 0) {
        console.log(`Attempting HTML fallback extraction for ${platformName} (${feedUrl})`);
        const originMatch = feedUrl.match(/^(https?:\/\/[^\/]+)/i);
        const baseUrl = originMatch ? originMatch[1] : '';
        const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let m;
        const seen = new Set();
        while ((m = linkRegex.exec(text)) !== null) {
          let href = m[1].trim();
          let rawTitle = m[2].replace(/<[^>]*>/g, '').trim()
            .replace(/&#x27;/g, "'")
            .replace(/&#8217;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"');

          // Check if link looks like an article or news post
          const isArticleLink = /\/(?:news|article|story|post|p|202[4-9])\/[a-zA-Z0-9_-]+/i.test(href);
          if (isArticleLink && rawTitle.length > 20 && !seen.has(href)) {
            seen.add(href);
            const fullLink = href.startsWith('http') ? href : (baseUrl + (href.startsWith('/') ? href : `/${href}`));
            items.push({
              title: rawTitle,
              link: fullLink,
              description: rawTitle,
              time: 'Recently'
            });
            if (items.length >= 15) break;
          }
        }
      }
    }

    // If top articles lack images (e.g. TechCrunch, Decrypt, or custom HTML articles), fetch og:image on the fly for the first 5 articles
    for (let i = 0; i < Math.min(items.length, 5); i++) {
      if (!items[i].image && !items[i].video && items[i].link) {
        try {
          const ogImg = await fetchArticleImage(items[i].link);
          if (ogImg) {
            items[i].image = ogImg;
          }
        } catch (_) {}
      }
    }

    // Add platform name
    return items.map(item => ({
      ...item,
      platform: platformName
    }));

  } catch (error) {
    console.error(`Error fetching ${platformName}:`, error.message);
    return [];
  }
}

/**
 * Get platform by ID
 */
export function getPlatformById(platformId) {
  return NEWS_PLATFORMS.find(p => p.id === platformId);
}

const OWNER_CHAT_ID = 685669468;

const OWNER_STRUCTURE = `🟢 Hybrid: [Name]

Value [5+ lines insight]

@true_feed`;

const DEFAULT_USER_STRUCTURE = `[Bold Headline]

[Summary text]

[Source Link]`;

/**
 * Free Google Translate fallback when OpenRouter has no credits or fails
 */
export async function translateWithGoogle(text, targetLang = 'am') {
  if (!text) return '';
  try {
    const tl = ['am', 'ti', 'om'].includes(targetLang) ? targetLang : 'am';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=` + encodeURIComponent(text);
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0].map(s => s[0]).join('');
    }
    return text;
  } catch (e) {
    console.error('Google Translate fallback error:', e.message);
    return text;
  }
}

export function cleanEthiopicPunctuation(text) {
  if (!text) return '';
  return text
    .replace(/፤/g, '፣')
    .replace(/፡/g, ' ')
    .replace(/፦/g, ':-')
    .replace(/፧/g, '?')
    .replace(/[፠፟]/g, '')
    .replace(/[ ]{2,}/g, ' ');
}

function cleanAmharicPunctuation(text, useDots = false) {
  if (!text) return '';
  if (useDots) {
    return text
      .replace(/[።፤]/g, ' . . . ')
      .replace(/[፣፡]/g, ' . . ')
      .replace(/\s*\.\s*\.\s*\.\s*/g, ' . . . ')
      .replace(/([^\.])\s*\.\s*\.\s*([^\.])/g, '$1 . . $2')
      .replace(/[ ]{2,}/g, ' ')
      .trim();
  }
  // Standard Amharic: keep ። (full stop), remove unwanted ፤ and replace with ፣ or standard punctuation
  return cleanEthiopicPunctuation(text).trim();
}

/**
 * Generate news content respecting the user structure template
 */
async function generateFallbackContent(article, structure, userChannelLink, showSourceLink, isOwner = false, useDots = false, targetLang = null) {
  let clean = (structure || DEFAULT_USER_STRUCTURE)
    .replace(/^(?:Content Structure\s*|Your current structure:\s*|Current structure:\s*)+/gi, '')
    .trim();

  // Auto-normalize missing opening bracket if line ends with ]
  clean = clean.replace(/^([^\[\n\r]+\])/, '[$1');
  clean = clean.replace(/(?:^|\n)([^\[\n\r]+)\]/g, (m, p1) => {
    return (m.startsWith('\n') ? '\n[' : '[') + p1.trim() + ']';
  });

  const targetChannel = isOwner ? '@true_feed' : (userChannelLink || '@true_feed');
  const sourceLink = article.link ? `<a href="${article.link}">${article.platform || 'Source'}</a>` : '';

  // 1. Channel replacement: handle [@true_feed in Bold style], [Channel], [@channel], etc.
  clean = clean.replace(/\[\s*(@[a-zA-Z0-9_]+)\s+in\s+bold(?:\s+style)?\s*\]/gi, '<b>$1</b>');
  clean = clean.replace(/\[\s*(@[a-zA-Z0-9_]+)\s+in\s+italic(?:\s+style)?\s*\]/gi, '<i>$1</i>');
  clean = clean.replace(/\[\s*(@[a-zA-Z0-9_]+)\s*\]/gi, '$1');

  if (/\[(?:Channel|ቻናል)\]/i.test(clean)) {
    clean = clean.replace(/\[(?:Channel|ቻናል)\]/gi, targetChannel);
  }

  // 2. Source link replacement
  clean = clean.replace(/\[(?:Source\s*link|Source|Link|ምንጭ|የምንጭ\s*ሊንክ)\]/gi, sourceLink);

  const rawTitle = (article.title || '').replace(/<[^>]*>/g, '').trim();
  const rawDesc = (article.description || article.content || '').replace(/<[^>]*>/g, '').trim().substring(0, 500);

  // 5. Check if structure has bracket placeholders
  const hasPlaceholders = /\[.*?\]/.test(clean);

  if (hasPlaceholders) {
    // 3. Title handling (check for translation language, Bold, and Italic directives)
    const isAmharicTitle = /\[.*?(?:headline|title|name).*?(?:amharic|አማርኛ).*?\]/i.test(clean) || /\[.*?ርዕስ.*?\]/i.test(clean);
    const isBoldTitle = /\[.*?bold.*?(?:headline|title|name|ርዕስ).*?\]/i.test(clean);
    const isItalicTitle = /\[.*?italic.*?(?:headline|title|name|ርዕስ).*?\]/i.test(clean);

    let formattedTitle;
    const shouldTranslate = (targetLang && targetLang !== 'en') || isAmharicTitle;
    const langToUse = (targetLang && targetLang !== 'en') ? targetLang : 'am';

    if (shouldTranslate) {
      formattedTitle = cleanAmharicPunctuation(await translateWithGoogle(rawTitle, langToUse), useDots);
    } else {
      formattedTitle = rawTitle;
    }

    if (isBoldTitle && isItalicTitle) {
      formattedTitle = `<b><i>${formattedTitle}</i></b>`;
    } else if (isBoldTitle) {
      formattedTitle = `<b>${formattedTitle}</b>`;
    } else if (isItalicTitle) {
      formattedTitle = `<i>${formattedTitle}</i>`;
    }

    clean = clean.replace(/\[.*?(?:headline|title|name|topic|ርዕስ|ዜና).*?\]/gi, formattedTitle);

    // 4. Description/Summary handling
    const isAmharicDesc = /\[.*?(?:summary|insight|content|text|details|facts?).*?(?:amharic|አማርኛ).*?\]/i.test(clean) || /\[.*?(?:መረጃ|ዝርዝር).*?\]/i.test(clean);
    let formattedDesc;
    if (shouldTranslate || isAmharicDesc) {
      formattedDesc = cleanAmharicPunctuation(await translateWithGoogle(rawDesc, langToUse), useDots);
    } else {
      formattedDesc = rawDesc;
    }

    // Split description into sentences/points for bullet points
    const rawSentences = rawDesc.split(/(?<=[.!?])\s+/).filter(s => s.length > 10);
    const points = [];
    for (let i = 0; i < Math.min(rawSentences.length, 4); i++) {
      const t = (shouldTranslate || isAmharicDesc)
        ? cleanAmharicPunctuation(await translateWithGoogle(rawSentences[i], langToUse), useDots)
        : rawSentences[i];
      points.push(t);
    }
    if (points.length === 0 && formattedDesc) {
      points.push(formattedDesc);
    }

    // Replace 5+ lines insight for Owner structure
    if (/\[5\+\s*lines\s*insight\]/i.test(clean)) {
      const insightLines = points.length > 1
        ? points.join('\n')
        : (formattedDesc + (shouldTranslate || isAmharicDesc ? '\nይህ አዲስ መረጃ ለተጠቃሚዎች ትልቅ ፋይዳ አለው' : '\nThis update provides key value.'));
      clean = clean.replace(/\[5\+\s*lines\s*insight\]/gi, insightLines);
    }

    // Replace summary / insight / content placeholders
    clean = clean.replace(/\[.*?(?:summary|insight|content|text|details|problem|solution|መረጃ|ዝርዝር).*?\]/gi, formattedDesc);

    // Replace numbered facts/points: [Point 1], [Fact 1], etc.
    let pointIndex = 0;
    clean = clean.replace(/\[(?:Fact|Point|ነጥብ)\s*(\d*)\]/gi, (match, num) => {
      const idx = num ? parseInt(num) - 1 : pointIndex++;
      return points[idx] || points[0] || formattedDesc;
    });

    // Clean any remaining unreplaced bracket placeholders
    clean = clean.replace(/\[.*?\]/g, '').trim();

    return clean;
  }

  // 6. If structure is a sample post (no brackets)
  const isAmharicStructure = /(?:አማርኛ|ዜና|መረጃ)/.test(clean);
  const shouldTranslateSample = (targetLang && targetLang !== 'en') || isAmharicStructure;
  const sampleLang = (targetLang && targetLang !== 'en') ? targetLang : 'am';

  const sampleTitle = shouldTranslateSample
    ? cleanAmharicPunctuation(await translateWithGoogle(rawTitle, sampleLang), useDots)
    : rawTitle;
  const sampleDesc = shouldTranslateSample
    ? cleanAmharicPunctuation(await translateWithGoogle(rawDesc, sampleLang), useDots)
    : rawDesc;
  const rawSentences = rawDesc.split(/(?<=[.!?])\s+/).filter(s => s.length > 10);
  const samplePoints = [];
  for (let i = 0; i < Math.min(rawSentences.length, 4); i++) {
    const t = shouldTranslateSample
      ? cleanAmharicPunctuation(await translateWithGoogle(rawSentences[i], sampleLang), useDots)
      : rawSentences[i];
    samplePoints.push(t);
  }

  const lines = clean.split('\n');
  const resultLines = [];
  let titlePlaced = false;
  let pIdx = 0;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      resultLines.push('');
      continue;
    }

    if (trimmed.startsWith('@')) {
      resultLines.push(targetChannel);
      continue;
    }

    // Bullet line
    const bulletMatch = trimmed.match(/^([•\-\*🔹▪️▫️🔸♦️])\s*(.*)$/);
    if (bulletMatch) {
      const bulletChar = bulletMatch[1];
      const pointText = samplePoints[pIdx] || samplePoints[0] || sampleDesc;
      pIdx++;
      resultLines.push(`${bulletChar} ${pointText}`);
      continue;
    }

    // Title line (first non-empty line)
    if (!titlePlaced) {
      const emojiMatch = trimmed.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF])\s*(.*)$/);
      if (emojiMatch) {
        resultLines.push(`${emojiMatch[1]} ${sampleTitle}`);
      } else {
        resultLines.push(sampleTitle);
      }
      titlePlaced = true;
      continue;
    }

    // Body / summary line
    resultLines.push(sampleDesc);
  }

  return resultLines.join('\n');
}

/**
 * Generate Amharic news content using AI
 */
async function generateAmharicNews(article, userChannelLink = null, showSourceLink = true, useDotPunctuation = false, userId = null, targetLang = null) {
  let structure = null;
  let isOwner = false;
  try {
    // Use RSS description for context (no web scraping)
    let articleContext = article.description
      ? article.description.replace(/<[^>]*>/g, '').trim().substring(0, 1000)
      : '';

    if (!articleContext) {
      articleContext = article.title;
    }

    // Identify user
    let user = null;
    if (userId) {
      user = await getUserByTelegramId(userId);
    }

    isOwner = (userId === OWNER_CHAT_ID) || (user?.telegram_id === OWNER_CHAT_ID);

    // Get user's content structure if userId is provided
    if (user) {
      console.log('🔍 Fetching user for userId:', userId);
      console.log('✅ User found, database ID:', user.id);
      const customStructure = await getContentStructure(user.id);
      console.log('🔍 Custom structure query result:', customStructure);
      if (customStructure && customStructure.structure_template) {
        structure = customStructure.structure_template;
        console.log('✅ Using USER custom structure for news translation:', userId);
        console.log('📋 Structure content:', structure);
      } else {
        console.log('ℹ️ No custom structure found for user:', user.id);
      }
    } else {
      console.log('ℹ️ No user found for userId:', userId);
    }

    // If user is guest or has no custom structure
    const isGuest = user?.user_type === 'guest';
    if (isGuest) {
      structure = DEFAULT_USER_STRUCTURE;
    } else if (!structure) {
      if (isOwner) {
        structure = OWNER_STRUCTURE;
        console.log('👑 Using OWNER structure for news translation');
      } else {
        structure = DEFAULT_USER_STRUCTURE;
        console.log('ℹ️ Using DEFAULT structure for news translation');
      }
    }

    let cleanStructure = structure.replace(/^(?:Content Structure\s*|Your current structure:\s*|Current structure:\s*)+/gi, '').trim();

    // Auto-normalize missing brackets in template (e.g. "Bold Headline ]" -> "[Bold Headline]")
    cleanStructure = cleanStructure.replace(/^([^\[\n\r]+\])/, '[$1');
    cleanStructure = cleanStructure.replace(/(?:^|\n)([^\[\n\r]+)\]/g, (m, p1) => {
      return (m.startsWith('\n') ? '\n[' : '[') + p1.trim() + ']';
    });

    const targetChannel = isOwner ? '@true_feed' : (userChannelLink || '@true_feed');

    const langName = targetLang === 'ti' ? 'Tigrinya' : (targetLang === 'om' ? 'Afaan Oromo' : (targetLang === 'en' ? 'English' : 'Amharic'));

    const systemPrompt = `You are an expert translator and content generator.
The user wants you to format the news content into their exact structure template.
Target Language: ${langName}.

CRITICAL INSTRUCTIONS ON USER'S TEMPLATE:
1. Replicate the user's template layout, emojis, spacing, line breaks, and formatting EXACTLY.
2. Replace headline/title placeholders (such as [Headline], [Title], [Bold Headline], [Bold Italic Headline], [Title in Amharic], [ርዕስ], etc.):
   - If target language is specified (${langName}), translate/output the headline in ${langName}.
   - If the placeholder specifies 'Bold', wrap it in HTML <b>Headline</b>.
   - If the placeholder specifies 'Italic', wrap it in HTML <i>Headline</i>. If both Bold and Italic: <b><i>Headline</i></b>.
3. Replace summary/body/insight placeholders (such as [Summary], [Summary text], [Long Summary], [Content], [Insight], [መረጃ], etc.):
   - If target language is specified (${langName}), provide the summary in ${langName}.
   - If the placeholder specifies 'Long Summary', provide a detailed 3-5 sentence comprehensive summary.
4. Replace source link placeholders (such as [Source link], [Source Link], [Source], [Link], [ምንጭ]) with <a href="${article.link}">${article.platform || 'Source'}</a>.
5. Channel handles & attribution placeholders (such as [@true_feed in Bold style ], [Channel], [@channel], etc.):
   - If the placeholder specifies Bold style (e.g. 'in Bold style', 'in bold'), wrap the handle in <b>@channel</b>.
   - If the placeholder specifies Italic style, wrap in <i>@channel</i>.
   - If a specific handle like @true_feed or @channel is written in the template, replace the placeholder bracket with that handle styled as requested (or plain if no style requested).
   - If [Channel] is used, replace it with '${targetChannel}'.
6. Do NOT add any extra text, intro, outro, headers, labels, or extra lines that are not in the template.
7. Output MUST NOT contain any unreplaced bracket placeholders like [Headline] or [...].
8. Output ONLY the filled-in template.`;

    const userPrompt = `TEMPLATE TO FOLLOW:
${cleanStructure}

NEWS CONTENT FROM PLATFORM:
Title: ${article.title}
Text: ${articleContext}

Output the final post now:`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 600,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.error('AI generation failed with status:', response.status);
      return await generateFallbackContent(article, cleanStructure, userChannelLink, showSourceLink, isOwner, useDotPunctuation, targetLang);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid AI response structure');
      return await generateFallbackContent(article, cleanStructure, userChannelLink, showSourceLink, isOwner, useDotPunctuation, targetLang);
    }

    const content = data.choices[0].message.content.trim();

    // Clean traditional Amharic punctuation (፤, ።, etc.)
    let cleaned = content;
    if (useDotPunctuation) {
      cleaned = content
        .replace(/[።፤]/g, ' . . . ')
        .replace(/[፣፡]/g, ' . . ')
        .replace(/\s*\.\s*\.\s*\.\s*/g, ' . . . ')
        .replace(/([^\.])\s*\.\s*\.\s*([^\.])/g, '$1 . . $2')
        .replace(/[ ]{2,}/g, ' ')
        .trim();
    } else {
      cleaned = cleanEthiopicPunctuation(content).trim();
    }

    return cleaned;

  } catch (error) {
    console.error('Error generating Amharic news:', error.message);
    return await generateFallbackContent(article, structure, userChannelLink, showSourceLink, isOwner, useDotPunctuation, targetLang);
  }
}

/**
 * Format single news article for Telegram
 */
export async function formatNewsArticle(article, userChannelLink = null, showSourceLink = true, useDotPunctuation = false, userId = null, targetLang = null) {
  // Generate content with AI or fallback
  const formattedContent = await generateAmharicNews(article, userChannelLink, showSourceLink, useDotPunctuation, userId, targetLang);
  return formattedContent;
}

/**
 * Helper to escape HTML characters in text segments
 */
function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Convert Telegram entities (bold, italic, etc.) into HTML tags
 */
export function entitiesToHTML(text, entities = []) {
  if (!text) return '';
  if (!entities || entities.length === 0) {
    return text;
  }

  // Create tag boundary events
  const events = [];
  for (const entity of entities) {
    const { type, offset, length } = entity;
    if (typeof offset !== 'number' || typeof length !== 'number') continue;

    let openTag = '';
    let closeTag = '';
    if (type === 'bold') {
      openTag = '<b>';
      closeTag = '</b>';
    } else if (type === 'italic') {
      openTag = '<i>';
      closeTag = '</i>';
    } else if (type === 'underline') {
      openTag = '<u>';
      closeTag = '</u>';
    } else if (type === 'strikethrough') {
      openTag = '<s>';
      closeTag = '</s>';
    } else if (type === 'code') {
      openTag = '<code>';
      closeTag = '</code>';
    } else if (type === 'pre') {
      openTag = '<pre>';
      closeTag = '</pre>';
    } else if (type === 'text_link' && entity.url) {
      openTag = `<a href="${entity.url}">`;
      closeTag = '</a>';
    }

    if (openTag && closeTag) {
      events.push({ pos: offset, tag: openTag, isClose: false });
      events.push({ pos: offset + length, tag: closeTag, isClose: true });
    }
  }

  if (events.length === 0) return text;

  // Sort by position ascending. At same position: closing tags before opening tags
  events.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.isClose && !b.isClose) return -1;
    if (!a.isClose && b.isClose) return 1;
    return 0;
  });

  let result = '';
  let lastPos = 0;
  for (const ev of events) {
    if (ev.pos > lastPos) {
      const slice = text.slice(lastPos, ev.pos);
      result += escapeHTML(slice);
      lastPos = ev.pos;
    }
    result += ev.tag;
  }
  if (lastPos < text.length) {
    result += escapeHTML(text.slice(lastPos));
  }
  return result;
}

/**
 * Format and sanitize user-edited news text to ensure required HTML styling (bold title)
 */
export function formatEditedNewsText(rawText, entities = [], useDotPunctuation = false, addTrueFeedAttribution = false) {
  if (!rawText) return '';

  let formatted = rawText;

  // 1. If Telegram entities exist (user formatted text using Telegram UI), convert to HTML
  if (entities && entities.length > 0) {
    formatted = entitiesToHTML(rawText, entities);
  }

  // 2. Convert common markdown bold/italic syntax if present
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  formatted = formatted.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, '$1<b>$2</b>$3');

  // 3. Ensure title (first non-empty line) is bold
  const lines = formatted.split('\n');
  const firstLineIdx = lines.findIndex(l => l.trim().length > 0);
  if (firstLineIdx !== -1) {
    const trimmedLine = lines[firstLineIdx].trim();
    // If the line is not already wrapped in <b> or <strong>
    if (!trimmedLine.includes('<b>') && !trimmedLine.includes('<strong>')) {
      lines[firstLineIdx] = `<b>${trimmedLine}</b>`;
    }
  }
  formatted = lines.join('\n');

  // 4. Ensure @true_feed is bold (only if requested)
  if (addTrueFeedAttribution) {
    if (formatted.includes('@true_feed')) {
      formatted = formatted.replace(/(?:\*|<b>|<strong>)?@true_feed(?:\*|<\/b>|<\/strong>)?/g, '<b>@true_feed</b>');
    } else {
      formatted = formatted.trim() + '\n\n<b>@true_feed</b>';
    }
  }

  // 5. Clean punctuation (replace ፤ and Ethiopic punctuation or use dot pauses if user prefers)
  if (useDotPunctuation) {
    formatted = formatted
      .replace(/[።፤]/g, ' . . . ')
      .replace(/[፣፡]/g, ' . . ')
      .replace(/\s*\.\s*\.\s*\.\s*/g, ' . . . ')
      .replace(/([^\.])\s*\.\s*\.\s*([^\.])/g, '$1 . . $2')
      .replace(/[ ]{2,}/g, ' ')
      .trim();
  } else {
    formatted = cleanEthiopicPunctuation(formatted).trim();
  }

  return formatted;
}
