import { fetch } from 'sdk';

/**
 * Fetch Ethiopian bank exchange rates from exchange.et
 * Returns NBE reference rate and bank rates for USD/ETB
 */
export async function fetchEthiopianDollarRates() {
  try {
    const response = await fetch('https://exchange.et/?pair=USD');
    const html = await response.text();

    // Extract NBE reference rate
    const nbeMatch = html.match(/NBE reference rate\*\*([\d.]+)\*\*USD\/ETB/);
    const nbeRate = nbeMatch ? nbeMatch[1] : null;

    // Extract individual bank rates
    const bankRates = [];
    const bankPattern = /([A-Za-z\s]+)\s*\│([\d.]+)\│([\d.]+)/g;
    let match;

    while ((match = bankPattern.exec(html)) !== null) {
      const bankName = match[1].trim();
      const buyRate = match[2];
      const sellRate = match[3];

      // Filter out table headers and invalid entries
      if (bankName && bankName !== 'Bank' && !bankName.includes('────────')) {
        bankRates.push({
          bank: bankName,
          buy: parseFloat(buyRate),
          sell: parseFloat(sellRate)
        });
      }
    }

    return {
      nbe_rate: nbeRate ? parseFloat(nbeRate) : null,
      banks: bankRates,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching Ethiopian dollar rates:', error);
    throw error;
  }
}

/**
 * Fetch Bitcoin (BTC) price in USD
 * Using CoinGecko API (free, no API key required)
 */
export async function fetchBTCPrice() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
    const data = await response.json();

    return {
      price: data.bitcoin.usd,
      change_24h: data.bitcoin.usd_24h_change,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching BTC price:', error);
    throw error;
  }
}

/**
 * Format Ethiopian rates for Telegram message
 */
export function formatEthiopianRates(rates) {
  let message = '💰 <b>Ethiopian Dollar Rates (USD/ETB)</b>\n\n';

  if (rates.nbe_rate) {
    message += `🏛️ <b>NBE Reference Rate:</b> ${rates.nbe_rate.toFixed(4)} ETB\n\n`;
  }

  message += '<b>Bank Rates:</b>\n';
  rates.banks.slice(0, 10).forEach(bank => {
    message += `• ${bank.bank}: Buy ${bank.buy.toFixed(4)} | Sell ${bank.sell.toFixed(4)}\n`;
  });

  if (rates.banks.length > 10) {
    message += `\n... and ${rates.banks.length - 10} more banks\n`;
  }

  message += `\n📅 Last updated: ${new Date(rates.timestamp).toLocaleString()}`;
  message += '\n\n<i>Rates from exchange.et</i>';

  return message;
}

/**
 * Format BTC price for Telegram message
 */
export function formatBTCPrice(btcData) {
  const changeEmoji = btcData.change_24h >= 0 ? '📈' : '📉';
  const changeColor = btcData.change_24h >= 0 ? '+' : '';

  return `₿ <b>Bitcoin (BTC) Price</b>\n\n` +
         `💵 <b>Price:</b> $${btcData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
         `${changeEmoji} <b>24h Change:</b> ${changeColor}${btcData.change_24h.toFixed(2)}%\n\n` +
         `📅 Last updated: ${new Date(btcData.timestamp).toLocaleString()}\n\n` +
         `<i>Data from CoinGecko</i>`;
}
