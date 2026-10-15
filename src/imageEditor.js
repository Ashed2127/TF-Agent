const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Add TF logo overlay to an image
 * @param {Buffer} imageBuffer - Image buffer to add logo to
 * @returns {Promise<Buffer>} - Image with logo overlay
 */
async function addLogoOverlay(imageBuffer) {
  try {
    console.log('🏷️ Adding TF logo overlay...');

    const logoPath = path.join(__dirname, 'tf.jpg');

    if (!fs.existsSync(logoPath)) {
      console.warn('⚠️ TF logo not found, skipping logo overlay');
      return imageBuffer;
    }

    // Load the main image
    const mainImage = sharp(imageBuffer);
    const metadata = await mainImage.metadata();

    // Load the logo
    const logoBuffer = fs.readFileSync(logoPath);
    const logo = sharp(logoBuffer);
    const logoMetadata = await logo.metadata();

    // Calculate logo size - make it proportional to the main image (about 25% of width for better visibility)
    const logoWidth = Math.round(metadata.width * 0.25);
    const logoHeight = Math.round(logoWidth * (logoMetadata.height / logoMetadata.width));

    // Resize logo
    const resizedLogo = await logo
      .resize(logoWidth, logoHeight, { fit: 'cover' })
      .png()
      .toBuffer();

    // Position logo in bottom-right corner with some padding
    const padding = Math.round(metadata.width * 0.02);
    const left = metadata.width - logoWidth - padding;
    const top = metadata.height - logoHeight - padding;

    // Composite logo onto main image
    const result = await mainImage
      .composite([{
        input: resizedLogo,
        left: left,
        top: top
      }])
      .jpeg({ quality: 90 })
      .toBuffer();

    console.log('✅ TF logo overlay added successfully');
    return result;

  } catch (error) {
    console.error('❌ Error adding logo overlay:', error.message);
    // Return original image if logo overlay fails
    return imageBuffer;
  }
}

/**
 * Edit an image using OpenRouter's Image API to create a tech news explainer card style
 * @param {string} imageUrl - URL of the source image to edit
 * @param {string} headline - News headline to include in the image
 * @returns {Promise<Buffer>} - Edited image as buffer
 */
async function editNewsImage(imageUrl, headline) {
  try {
    console.log('🎨 Starting image editing process...');

    // Download the source image
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const imageBuffer = Buffer.from(imageResponse.data, 'binary');
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    // Create the edit prompt based on the tech news explainer card style
    const editPrompt = `Transform this image into a social media tech news explainer card and digital collage thumbnail in a 16:9 aspect ratio.

Visual Style: Clean pop-infographic, sticker-cutout collage aesthetic, modern social news card.
Background: Solid muted sage green or vibrant purple gradient with subtle depth effect.
Main Subjects: The original image elements placed as floating sticker cutouts with thick white outlines and soft drop shadows, or framed inside neat rectangular photo cards with bold high-contrast borders.
Connecting Elements: Hand-drawn style curving pointer lines or squiggly graphic arrows connecting entities to illustrate relationships.
Text Callout / Overlay: A prominent rounded lower-third badge / speech-bubble style text box with a bold border in vivid yellow or electric purple. Inside the box, bold, crisp, highly legible sans-serif typography displaying the news headline: "${headline}".
Sub-labels: Crisp black or white label badges identifying key names/titles directly below the photos.
Overall Aesthetic: Bold contrast, feed-stopping tech journalism graphic, highly readable, sharp vector-like graphic overlays.

Keep the original image content recognizable but apply this tech news explainer card style transformation.`;

    console.log('📝 Sending edit request to OpenRouter Image API...');

    const response = await axios.post('https://openrouter.ai/api/v1/images', {
      model: 'google/gemini-nano-banana-2.1',
      prompt: editPrompt,
      input_references: [dataUrl],
      aspect_ratio: '16:9',
      resolution: '2K'
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    if (!response.data || !response.data.data || !response.data.data[0]) {
      throw new Error('Invalid response from OpenRouter Image API');
    }

    const editedImageBase64 = response.data.data[0].b64_json;
    const editedImageBuffer = Buffer.from(editedImageBase64, 'base64');

    // Add TF logo overlay
    const finalImageBuffer = await addLogoOverlay(editedImageBuffer);

    console.log('✅ Image editing completed successfully');
    console.log(`Final image size: ${finalImageBuffer.length} bytes`);
    return finalImageBuffer;

  } catch (error) {
    console.error('❌ Error editing image:', error.message);
    if (error.response) {
      console.error('OpenRouter API response:', error.response.status, error.response.data);
    }
    throw new Error(`Failed to edit image: ${error.message}`);
  }
}

module.exports = {
  editNewsImage
};
