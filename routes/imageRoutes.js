const express = require('express');
const router = express.Router();

// YOUR PEXELS API KEY
const PEXELS_API_KEY = 'XCbdzZIB8K42w7aBhX5l5Ei7PwxxMyOFDOL4mwCPEHc9i63UrEIj2vwo';

// Get food image from Pexels
router.get('/food/:dish', async (req, res) => {
  const dishName = req.params.dish;
  const searchQuery = encodeURIComponent(`${dishName} food dish restaurant`);
  
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${searchQuery}&per_page=1&orientation=square`,
      {
        headers: {
          'Authorization': PEXELS_API_KEY
        }
      }
    );
    
    const data = await response.json();
    
    if (data.photos && data.photos.length > 0) {
      const imageUrl = data.photos[0].src.medium;
      res.json({ success: true, url: imageUrl });
    } else {
      res.json({ success: false, url: null });
    }
  } catch (error) {
    console.error('Image fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

module.exports = router;