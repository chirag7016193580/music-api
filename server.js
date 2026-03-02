const express = require('express');
const cors = require('cors');
const axios = require('axios'); 

const app = express();

// CORS ko configure karein taaki kisi bhi frontend se request aa sake
app.use(cors());

// Root route check karne ke liye ki server chal raha hai
app.get('/', (req, res) => {
    res.send('API Chal Rahi Hai! Music search karne ke liye /api/search?song=Galiyan ka use karein.');
});

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.song;
        if (!query) return res.json({ error: "Kripya 'song' query parameter dein." });

        const apiUrl = `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${encodeURIComponent(query)}`;
        console.log(`🔎 Gaana search ho raha hai: ${query}`);
        
        const response = await axios.get(apiUrl);
        
        let songsData = [];
        if (response.data && response.data.data && response.data.data.results) {
            songsData = response.data.data.results;
        } else if (response.data && response.data.results) {
            songsData = response.data.results;
        }

        if (songsData.length === 0) {
            console.log("❌ API ne koi result nahi diya.");
            return res.json([]);
        }
        
        const cleanSongs = songsData.map(song => {
            let audioLink = "";
            if (song.downloadUrl && Array.isArray(song.downloadUrl)) {
                audioLink = song.downloadUrl[song.downloadUrl.length - 1].link; 
            }

            let imageLink = "";
            if (song.image && Array.isArray(song.image)) {
                imageLink = song.image[song.image.length - 1].link;
            }

            return {
                title: song.name || song.title || "Unknown Song",
                artist: song.primaryArtists || song.singers || "Unknown Artist",
                image: imageLink || "https://via.placeholder.com/150",
                audioUrl: audioLink
            };
        });

        const validSongs = cleanSongs.filter(song => song.audioUrl !== "");
        res.json(validSongs.slice(0, 10)); 

    } catch (error) {
        console.error("❌ API Error:", error.message);
        res.status(500).json({ error: "Server connect nahi ho paya!" });
    }
});

// Ye local testing ke liye hai
if (process.env.NODE_ENV !== 'production') {
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`✅ Local Server chal raha hai: http://localhost:${PORT}`);
    });
}

// Vercel ke liye app ko export karna zaruri hai
module.exports = app;