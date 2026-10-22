import { fetch } from 'sdk';

/**
 * Priority list for Ethiopian banks to show in the summary
 */
const PRIORITY_BANKS = [
  'Commercial Bank of Ethiopia',
  'Awash Bank',
  'Bank of Abyssinia',
  'Dashen Bank',
  'Wegagen Bank',
  'Cooperative Bank of Oromia',
  'Oromia Bank',
  'Hibret Bank',
  'Nib International Bank',
  'EBR Exchange'
];

/**
 * Fetch Ethiopian bank exchange rates from ET-Forex API, with fallback to CoinGecko
 * Returns NBE reference rate and bank rates for USD/ETB
 */
export async function fetchEthiopianDollarRates() {
  try {
    // Primary source: ET-Forex API for Ethiopian bank rates
    const banksToFetch = ['CBE', 'Awash', 'BOA', 'Dashen', 'Wegagen', 'CBO', 'Oromia', 'Hibret', 'Nib', 'EBR'];
    const bankRates = [];
    const seen = new Set();

    for (const bankCode of banksToFetch) {
      try {
        const response = await fetch(`https://api.et-forex.com/api/v1/banks/${bankCode}/rates`);
        const data = await response.json();

        if (data.success && data.data && data.data.rates) {
          const usdRate = data.data.rates.find(r => r.currency === 'USD');
          if (usdRate) {
            const bankName = data.data.bankName || bankCode;
            if (!seen.has(bankName)) {
              seen.add(bankName);
              bankRates.push({
                bank: bankName,
                buy: parseFloat(usdRate.transactionalBuying || usdRate.cashBuying),
                sell: parseFloat(usdRate.transactionalSelling || usdRate.cashSelling)
              });
            }
          }
        }
      } catch (bankError) {
        console.error(`Error fetching ${bankCode} rates:`, bankError);
        // Continue with other banks
      }
    }

    // Get NBE reference rate from Frankfurter API
    let nbeRate = null;
    try {
      const nbeResponse = await fetch('https://api.frankfurter.dev/v2/providers/nbe/rates');
      const nbeData = await nbeResponse.json();

      if (Array.isArray(nbeData) && nbeData.length > 0) {
        // Find USD rate (NBE data is EUR-based, so we need to calculate)
        const eurToUsd = nbeData.find(r => r.quote === 'USD');
        const eurToEtb = nbeData.find(r => r.quote === 'ETB');

        if (eurToUsd && eurToEtb) {
          // USD to ETB = ETB/EUR * EUR/USD
          nbeRate = (eurToEtb.rate / eurToUsd.rate);
        }
      }
    } catch (nbeError) {
      console.error('Error fetching NBE rates:', nbeError);
    }

    // Sort to show major Ethiopian banks first
    bankRates.sort((a, b) => {
      const aIdx = PRIORITY_BANKS.indexOf(a.bank);
      const bIdx = PRIORITY_BANKS.indexOf(b.bank);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.bank.localeCompare(b.bank);
    });

    if (nbeRate || bankRates.length > 0) {
      return {
        nbe_rate: nbeRate,
        banks: bankRates,
        timestamp: new Date().toISOString(),
        source: 'ET-Forex'
      };
    }

    throw new Error('No rate data found from ET-Forex API');
  } catch (error) {
    console.error('Error fetching from ET-Forex, trying fallback:', error);

    // Fallback: CoinGecko exchange rates
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/exchange_rates');
      const data = await response.json();

      const etbValue = data.rates?.etb?.value;
      const usdValue = data.rates?.usd?.value;

      if (!etbValue || !usdValue) {
        throw new Error('ETB/USD rates not available in CoinGecko response');
      }

      // Rates are base BTC, so ETB per USD = etb.value / usd.value
      const usdToEtb = etbValue / usdValue;

      return {
        nbe_rate: usdToEtb,
        banks: [],
        timestamp: new Date().toISOString(),
        source: 'CoinGecko'
      };
    } catch (fallbackError) {
      console.error('All exchange rate sources failed:', fallbackError);
      throw error;
    }
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

  if (rates.banks && rates.banks.length > 0) {
    message += '🏦 <b>Bank Rates:</b>\n';
    rates.banks.slice(0, 10).forEach(bank => {
      message += `• ${bank.bank}: Buy ${bank.buy.toFixed(2)} | Sell ${bank.sell.toFixed(2)}\n`;
    });

    if (rates.banks.length > 10) {
      message += `\n... and ${rates.banks.length - 10} more banks\n`;
    }
  }

  const dateStr = new Date(rates.timestamp).toLocaleString();
  message += `\n📅 Last updated: ${dateStr}`;
  message += `\n\n<i>Rates from ${rates.source || 'ET-Forex'}</i>`;

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
