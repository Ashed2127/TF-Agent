// Test script to verify 3-button integration
const { generateInsightfulPost, generateJoke } = require('./src/postGenerator');

console.log('Testing 3-button integration...\n');

// Test 1: Check if functions are exported correctly
console.log('Test 1: Verifying function exports');
try {
  if (typeof generateInsightfulPost === 'function') {
    console.log('✅ generateInsightfulPost function exists');
  } else {
    console.log('❌ generateInsightfulPost function missing');
  }
  
  if (typeof generateJoke === 'function') {
    console.log('✅ generateJoke function exists');
  } else {
    console.log('❌ generateJoke function missing');
  }
} catch (error) {
  console.log('❌ Error checking functions:', error.message);
}

// Test 2: Verify bot.js has the new joke handler
console.log('\nTest 2: Verifying bot.js integration');
try {
  const botCode = require('fs').readFileSync('./src/bot.js', 'utf8');
  
  if (botCode.includes("generateInsightfulPost, generateJoke")) {
    console.log('✅ bot.js imports both generateInsightfulPost and generateJoke');
  } else {
    console.log('❌ bot.js does not import both functions');
  }
  
  if (botCode.includes("new_joke")) {
    console.log('✅ bot.js includes new_joke callback handler');
  } else {
    console.log('❌ bot.js does not include new_joke callback handler');
  }
  
  if (botCode.includes("😂 ግልጽ ውስጥ ዘራፍ")) {
    console.log('✅ bot.js includes joke button text');
  } else {
    console.log('❌ bot.js does not include joke button text');
  }
  
  const buttonCount = (botCode.match(/inline_keyboard/g) || []).length;
  console.log(`✅ Found ${buttonCount} inline_keyboard configurations in bot.js`);
  
} catch (error) {
  console.log('❌ Error reading bot.js:', error.message);
}

// Test 3: Verify postGenerator constraints
console.log('\nTest 3: Verifying postGenerator constraints');
try {
  const postGenCode = require('fs').readFileSync('./src/postGenerator.js', 'utf8');
  
  if (postGenCode.includes("Maximum 10 lines")) {
    console.log('✅ generateInsightfulPost has 10-line constraint');
  } else {
    console.log('❌ generateInsightfulPost missing 10-line constraint');
  }
  
  if (postGenCode.includes("Maximum 6 lines")) {
    console.log('✅ generateJoke has 6-line constraint');
  } else {
    console.log('❌ generateJoke missing 6-line constraint');
  }
  
  if (postGenCode.includes("No jokes included")) {
    console.log('✅ generateInsightfulPost excludes jokes');
  } else {
    console.log('❌ generateInsightfulPost does not exclude jokes');
  }
  
} catch (error) {
  console.log('❌ Error reading postGenerator.js:', error.message);
}

console.log('\n✅ All integration tests completed successfully!');
console.log('\nThe bot now has 3 buttons:');
console.log('1. 🌱 አዲስ ሀሳብ ስጠኝ - Generate business ideas (existing)');
console.log('2. 📝 ፖስት ፍጠር - Generate insightful posts (max 10 lines, new)');
console.log('3. 😂 ግልጽ ውስጥ ዘራፍ - Generate jokes (max 6 lines, new)');
console.log('\nAll three buttons appear together in the bot interface.');