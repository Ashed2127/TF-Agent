const axios = require('axios');

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
      model: 'google/gemini-3.1-flash-image',
      prompt: editPrompt,
      input_references: [dataUrl],
      image_config: {
        aspect_ratio: '16:9',
        quality: 'high',
        output_format: 'png'
      }
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

    console.log('✅ Image editing completed successfully');
    return editedImageBuffer;

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
